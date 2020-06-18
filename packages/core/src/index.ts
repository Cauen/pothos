import InternalInputFieldBuilder from './fieldUtils/input';
import Field from './field';
import BuildCache from './build-cache';
import InternalFieldBuilder from './fieldUtils/builder';
import InternalRootFieldBuilder from './fieldUtils/root';
import InternalQueryFieldBuilder from './fieldUtils/query';
import InternalMutationFieldBuilder from './fieldUtils/mutation';
import InternalSubscriptionFieldBuilder from './fieldUtils/subscription';
import InternalObjectFieldBuilder from './fieldUtils/object';
import InternalInterfaceFieldBuilder from './fieldUtils/interface';
import SchemaBuilder from './builder';
import { FieldKind, SchemaTypes, MergedSchemaTypes } from './types';
import { BasePlugin } from './plugins';
import EnumRef from './refs/enum';
import InputObjectRef from './refs/input';
import InterfaceRef from './refs/interface';
import ObjectRef from './refs/object';
import ScalarRef from './refs/scalar';
import UnionRef from './refs/union';

export * from './types';
export * from './utils';
export * from './plugins';

export { BuildCache, Field, EnumRef, InputObjectRef, InterfaceRef, ObjectRef, ScalarRef, UnionRef };

export default SchemaBuilder as {
  new <Types extends GiraphQLSchemaTypes.PartialTypeInfo>(options?: {
    plugins?: BasePlugin[];
  }): GiraphQLSchemaTypes.SchemaBuilder<
    MergedSchemaTypes<GiraphQLSchemaTypes.MergedTypeMap<Types>>
  >;
};

export const FieldBuilder = InternalFieldBuilder as {
  new <
    Types extends SchemaTypes,
    ParentShape,
    Kind extends 'Object' | 'Interface' = 'Object' | 'Interface'
  >(
    name: string,
  ): GiraphQLSchemaTypes.FieldBuilder<Types, ParentShape, Kind>;
};

export const RootFieldBuilder = InternalRootFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape, Kind extends FieldKind = FieldKind>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape, Kind>;
};

export const QueryFieldBuilder = InternalQueryFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.QueryFieldBuilder<Types, ParentShape>;
};

export const MutationFieldBuilder = InternalMutationFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.RootFieldBuilder<Types, ParentShape>;
};

export const SubscriptionFieldBuilder = InternalSubscriptionFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.SubscriptionFieldBuilder<Types, ParentShape>;
};

export const ObjectFieldBuilder = InternalObjectFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.ObjectFieldBuilder<Types, ParentShape>;
};

export const InterfaceFieldBuilder = InternalInterfaceFieldBuilder as {
  new <Types extends SchemaTypes, ParentShape>(
    name: string,
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.InterfaceFieldBuilder<Types, ParentShape>;
};

export const InputFieldBuilder = InternalInputFieldBuilder as {
  new <Types extends SchemaTypes>(
    builder: GiraphQLSchemaTypes.SchemaBuilder<Types>,
  ): GiraphQLSchemaTypes.InputFieldBuilder<Types>;
};
