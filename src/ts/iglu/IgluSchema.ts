import { Schema } from "jsonschema";
import { Registry } from "./Registries";

const $SCHEMA =
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
}

export class ResolvedIgluSchema extends IgluSchema {
  constructor(
    readonly registry: Registry,
    readonly self: IgluSchema,
    readonly data: SelfDescribingSchema
  ) {
    super(self.vendor, self.name, self.format, self.version);
  }

  uri(): IgluUri {
    return this.self.uri();
  }

  validate(data: unknown): void {}
}
