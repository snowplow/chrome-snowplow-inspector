import { Schema, ValidatorResult } from "jsonschema";

import { Registry } from "./Registries";

export const $SCHEMA =
  "http://iglucentral.com/schemas/com.snowplowanalytics.self-desc/schema/jsonschema/1-0-0#";

type SelfDescribingSchema = Schema & {
  $schema: typeof $SCHEMA;
  self: {
    vendor: string;
    name: string;
    format: string;
    version: string;
  };
};

export type IgluUri =
  `iglu:${IgluSchema["vendor"]}/${IgluSchema["name"]}/${IgluSchema["format"]}/${IgluSchema["version"]}`;

export class IgluSchema {
  public searchIndex?: string;

  constructor(
    readonly vendor: string,
    readonly name: string,
    readonly format: string,
    readonly version: string
  ) {}

  static fromUri(uri: IgluUri): IgluSchema | null {
    const [scheme, ...body] = uri.split(":");
    if (scheme !== "iglu") return null;

    const [vendor, name, format, version, ...rest] = body.join(":").split("/");
    if (rest.length) return null;

    return new IgluSchema(vendor, name, format, version);
  }

  resolve(
    potentialSchema: unknown,
    registry: Registry
  ): ResolvedIgluSchema | null {
    if (typeof potentialSchema === "object" && potentialSchema) {
      if ("$schema" in potentialSchema) {
        const { $schema } = potentialSchema as { $schema: string };
        if ($schema === $SCHEMA && "self" in potentialSchema) {
          const schema = potentialSchema as SelfDescribingSchema;
          const { vendor, name, format, version } = schema.self;
          const matches =
            this.vendor === vendor &&
            this.name === name &&
            this.format === format &&
            this.version === version;

          if (matches) return new ResolvedIgluSchema(registry, this, schema);
        }
      }
    }
    return null;
  }

  uri(): IgluUri {
    return `iglu:${this.vendor}/${this.name}/${this.format}/${this.version}`;
  }

  toString(): IgluUri {
    return this.uri();
  }

  protected buildSearchIndex(schema: IgluSchema): string {
    const fields = new Set<string>([
      schema.name,
      schema.vendor,
      schema.version,
    ]);

    return Array.from(fields).join("\n");
  }

  like(re: RegExp): boolean {
    if (!this.searchIndex) this.searchIndex = this.buildSearchIndex(this);

    return re.test(this.searchIndex!);
  }
}

export class ResolvedIgluSchema extends IgluSchema {
  constructor(
    readonly registry: Registry,
    readonly self: IgluSchema,
    readonly data: SelfDescribingSchema
  ) {
    super(self.vendor, self.name, self.format, self.version);
  }

  protected buildSearchIndex(schema: ResolvedIgluSchema): string {
    const base = super.buildSearchIndex(schema);
    const fields = new Set<string>([base]);

    let data: Schema | undefined;
    const stack: typeof data[] = [data];
    const meta: (keyof Schema)[] = ["title", "description", "type"];
    while (stack.length) {
      data = stack.pop();
      if (!data) continue;

      for (const field of meta) {
        if (data[field]) fields.add(data[field]);
      }

      if (data.items) {
        for (const [prop, d] of Object.entries(data.items)) {
          stack.push(d);
        }
      }

      if (data.properties) {
        for (const [prop, d] of Object.entries(data.properties)) {
          fields.add(prop);
          stack.push(d);
        }
      }

      if (data.enum) Array.prototype.push.apply(fields, data.enum.map(String));
    }
    return Array.from(fields).join("\n");
  }

  uri(): IgluUri {
    return this.self.uri();
  }

  validate(data: unknown): ValidatorResult {
    return this.registry.validator.validate(data, this.data);
  }
}
