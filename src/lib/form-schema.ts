export type FieldType =
  | "text"
  | "email"
  | "textarea"
  | "number"
  | "boolean"
  | "select"
  | "async-select"
  | "key-value"
  | "attribute-list"
  | "json";

export interface BaseField<T extends FieldType = FieldType> {
  name: string;
  label: string;
  type: T;
  required?: boolean;
  help?: string;
  placeholder?: string;
  /** Path inside the API payload (dot notation). Defaults to name. */
  payloadPath?: string;
}

export interface TextField extends BaseField<"text" | "email" | "textarea"> {
  default?: string;
}

export interface NumberField extends BaseField<"number"> {
  default?: number;
}

export interface BooleanField extends BaseField<"boolean"> {
  default?: boolean;
}

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectField extends BaseField<"select"> {
  options: SelectOption[];
  default?: string;
}

export interface AsyncSelectField extends BaseField<"async-select"> {
  /** Endpoint id in the registry whose response populates the options. */
  sourceEndpointId: string;
  /** Dot-path into the list endpoint response that gives the array. */
  itemsPath?: string;
  /** Dot-path on each item for the option value. */
  valueKey: string;
  /** Dot-path on each item for the display label. */
  labelKey: string;
  default?: string;
}

export interface KeyValueField extends BaseField<"key-value"> {
  /** Default seed pairs. */
  default?: Record<string, string>;
  keyLabel?: string;
  valueLabel?: string;
}

export interface Attribute {
  name: string;
  type: string;
  value: string;
}

export interface AttributeListField extends BaseField<"attribute-list"> {
  default?: Attribute[];
  /** Available Dengage data types for the Type selector. */
  valueTypes?: string[];
}

export interface JsonField extends BaseField<"json"> {
  default?: unknown;
}

export type FormField =
  | TextField
  | NumberField
  | BooleanField
  | SelectField
  | AsyncSelectField
  | KeyValueField
  | AttributeListField
  | JsonField;

export interface FormSchema {
  fields: FormField[];
}

export type FormValues = Record<string, unknown>;

function setPath(obj: Record<string, unknown>, path: string, value: unknown) {
  const parts = path.split(".");
  let cur: Record<string, unknown> = obj;
  for (let i = 0; i < parts.length - 1; i++) {
    const k = parts[i];
    if (typeof cur[k] !== "object" || cur[k] === null) cur[k] = {};
    cur = cur[k] as Record<string, unknown>;
  }
  cur[parts[parts.length - 1]] = value;
}

/** Build the JSON payload from the form values using each field's payloadPath. */
export function buildPayload(schema: FormSchema, values: FormValues): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const field of schema.fields) {
    const path = field.payloadPath || field.name;
    const v = values[field.name];
    if (v === undefined || v === "" || v === null) continue;
    setPath(out, path, v);
  }
  return out;
}

/** Seed form values from the schema's defaults. */
export function seedValues(schema: FormSchema): FormValues {
  const v: FormValues = {};
  for (const f of schema.fields) {
    if ("default" in f && f.default !== undefined) v[f.name] = f.default;
    else if (f.type === "key-value") v[f.name] = {};
    else if (f.type === "attribute-list") v[f.name] = [];
    else if (f.type === "boolean") v[f.name] = false;
  }
  return v;
}
