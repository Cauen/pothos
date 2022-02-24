/* eslint-disable no-param-reassign */
/* eslint-disable no-continue */
import {
  FieldNode,
  FragmentDefinitionNode,
  getNamedType,
  GraphQLNamedType,
  GraphQLObjectType,
  GraphQLResolveInfo,
  InlineFragmentNode,
  isObjectType,
  Kind,
  SelectionSetNode,
} from 'graphql';
import { getArgumentValues } from 'graphql/execution/values';
import { SchemaTypes } from '@pothos/core';
import SchemaBuilder from '@pothos/core/lib/builder';
import { setLoaderMappings } from '../loader-map';
import {
  createState,
  mergeSelection,
  selectionCompatible,
  SelectionState,
  selectionToQuery,
} from './selections';

import { FieldSelection, IncludeMap, IndirectInclude, LoaderMappings, SelectionMap } from '..';

export function getIncludeFromSelections<Types extends SchemaTypes>(
  type: GraphQLNamedType,
  builder: SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
) {
  const state = createState();

  // TODO: handle multiple fields?
  addTypeSelectionsForField(type, builder, context, info, state, info.fieldNodes[0]);

  return { selection: selectionToQuery(state), mappings: state.mappings };
}

function addTypeSelectionsForField<Types extends SchemaTypes>(
  type: GraphQLNamedType,
  builder: SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[] = [],
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const { pothosPrismaInclude, pothosPrismaSelect, pothosPrismaIndirectInclude } =
    (type.extensions ?? {}) as {
      pothosPrismaInclude?: IncludeMap;
      pothosPrismaSelect?: IncludeMap;
      pothosPrismaIndirectInclude?: IndirectInclude;
    };

  if (pothosPrismaIndirectInclude) {
    resolveIndirectInclude(
      type,
      info,
      selection,
      pothosPrismaIndirectInclude.path,
      indirectPath,
      (resolvedType, field, path) => {
        addTypeSelectionsForField(resolvedType, builder, context, info, state, field, path);
      },
    );
  }

  if (!isObjectType(type)) {
    return;
  }

  if (pothosPrismaInclude || pothosPrismaSelect) {
    mergeSelection(state, {
      select: pothosPrismaSelect ? { ...pothosPrismaSelect } : undefined,
      include: pothosPrismaInclude ? { ...pothosPrismaInclude } : undefined,
    });
  }

  if (selection.selectionSet) {
    addNestedSelections(type, builder, context, info, state, selection.selectionSet, indirectPath);
  }
}

function resolveIndirectInclude(
  type: GraphQLNamedType,
  info: GraphQLResolveInfo,
  selection: FieldNode | FragmentDefinitionNode | InlineFragmentNode,
  includePath: IndirectInclude['path'],
  path: string[],
  resolve: (type: GraphQLNamedType, field: FieldNode, path: string[]) => void,
) {
  const [include, ...rest] = includePath;
  if (!selection.selectionSet || !include) {
    return;
  }

  for (const sel of selection.selectionSet.selections) {
    switch (sel.kind) {
      case Kind.FIELD:
        if (sel.name.value === include.name && isObjectType(type)) {
          const returnType = getNamedType(type.getFields()[sel.name.value].type);

          if (rest.length === 0) {
            resolve(returnType, sel, [...path, sel.alias?.value ?? sel.name.value]);
          } else {
            resolveIndirectInclude(
              returnType,
              info,
              sel,
              rest,
              [...path, sel.alias?.value ?? sel.name.value],
              resolve,
            );
          }
        }
        continue;
      case Kind.FRAGMENT_SPREAD:
        if (info.fragments[sel.name.value].typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            info.schema.getType(include.type)!,
            info,
            info.fragments[sel.name.value],
            includePath,
            path,
            resolve,
          );
        }

        continue;

      case Kind.INLINE_FRAGMENT:
        if (!sel.typeCondition || sel.typeCondition.name.value === include.type) {
          resolveIndirectInclude(
            sel.typeCondition ? info.schema.getType(sel.typeCondition.name.value)! : type,
            info,
            sel,
            includePath,
            path,
            resolve,
          );
        }

        continue;

      default:
        throw new Error(`Unsupported selection kind ${(selection as { kind: string }).kind}`);
    }
  }
}

function addNestedSelections<Types extends SchemaTypes>(
  type: GraphQLObjectType,
  builder: SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selections: SelectionSetNode,
  indirectPath: string[],
) {
  for (const selection of selections.selections) {
    switch (selection.kind) {
      case Kind.FIELD:
        addFieldSelection(type, builder, context, info, state, selection, indirectPath);

        continue;
      case Kind.FRAGMENT_SPREAD:
        if (info.fragments[selection.name.value].typeCondition.name.value !== type.name) {
          continue;
        }

        addNestedSelections(
          type,
          builder,
          context,
          info,
          state,
          info.fragments[selection.name.value].selectionSet,
          indirectPath,
        );

        continue;

      case Kind.INLINE_FRAGMENT:
        if (selection.typeCondition && selection.typeCondition.name.value !== type.name) {
          continue;
        }

        addNestedSelections(
          type,
          builder,
          context,
          info,
          state,
          selection.selectionSet,
          indirectPath,
        );

        continue;

      default:
        throw new Error(`Unsupported selection kind ${(selection as { kind: string }).kind}`);
    }
  }
}

function addFieldSelection<Types extends SchemaTypes>(
  type: GraphQLObjectType,
  builder: SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  state: SelectionState,
  selection: FieldNode,
  indirectPath: string[],
) {
  if (selection.name.value.startsWith('__')) {
    return;
  }

  const field = type.getFields()[selection.name.value];

  if (!field) {
    throw new Error(`Unknown field ${selection.name.value} on ${type.name}`);
  }

  let fieldSelect = field.extensions?.pothosPrismaSelect as FieldSelection | undefined;
  const fieldParentSelect = field.extensions?.pothosPrismaParentSelect as
    | Record<string, SelectionMap | boolean>
    | undefined;
  let mappings: LoaderMappings = {};

  if (typeof fieldSelect === 'function') {
    const args = getArgumentValues(field, selection, info.variableValues) as Record<
      string,
      unknown
    >;

    fieldSelect = fieldSelect(args, context, (rawQuery) => {
      const returnType = getNamedType(field.type);
      const query = typeof rawQuery === 'function' ? rawQuery(args, context) : rawQuery;

      const fieldState = createState({ parent: state });

      if (typeof query === 'object') {
        mergeSelection(fieldState, query);
      }

      addTypeSelectionsForField(returnType, builder, context, info, fieldState, selection);

      // eslint-disable-next-line prefer-destructuring
      mappings = fieldState.mappings;

      return selectionToQuery(fieldState);
    });
  }

  if (fieldSelect && selectionCompatible(state, { select: fieldSelect }, true)) {
    mergeSelection(state, { select: fieldSelect });
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      mappings,
      indirectPath,
    };
  } else if (
    fieldParentSelect &&
    state.parent &&
    selectionCompatible(state.parent, { select: fieldParentSelect }, true)
  ) {
    mergeSelection(state.parent, { select: fieldParentSelect });
    state.mappings[selection.alias?.value ?? selection.name.value] = {
      field: selection.name.value,
      mappings,
      indirectPath,
    };
  }
}

export function queryFromInfo<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  ctx: object,
  info: GraphQLResolveInfo,
  typeName?: string,
): {} {
  const type = typeName ? info.schema.getTypeMap()[typeName] : getNamedType(info.returnType);

  const { selection, mappings } = getIncludeFromSelections(type, builder, ctx, info);

  setLoaderMappings(ctx, info.path, mappings);

  return selection;
}

export function selectionFromInfo<Types extends SchemaTypes>(
  builder: PothosSchemaTypes.SchemaBuilder<Types>,
  context: object,
  info: GraphQLResolveInfo,
  typeName?: string,
) {
  const type = typeName ? info.schema.getTypeMap()[typeName] : info.parentType;

  const state = createState();

  if (!isObjectType(type)) {
    throw new Error('Prisma plugin can only resolve includes for object types');
  }

  // TODO: handle multiple fields?
  addFieldSelection(type, builder, context, info, state, info.fieldNodes[0], []);

  return state;
}