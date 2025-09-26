import { h, type FunctionComponent } from "preact";

const formatJson = (obj: unknown, indent = 0, keyPrefix = "root") => {
  const currentIndent = "  ".repeat(indent);
  const childIndent = "  ".repeat(indent + 1);

  if (typeof obj === "object" && obj !== null) {
    if (Array.isArray(obj)) {
      const elements = [
        <span key={`${keyPrefix}bracket-open`} className="text-yellow-400">
          [
        </span>,
      ];

      if (obj.length > 0) {
        obj.forEach((item, index) => {
          const itemKey = `${keyPrefix}item-${index}`;
          elements.push(
            <br key={`${itemKey}-br`} />,
            <span key={`${itemKey}-indent`} className="text-muted-foreground">
              {childIndent}
            </span>,
            ...formatJson(item, indent + 1, itemKey),
          );

          if (index < obj.length - 1) {
            elements.push(
              <span key={`${itemKey}-comma`} className="text-foreground">
                ,
              </span>,
            );
          }
        });

        elements.push(
          <br key={`${keyPrefix}array-close-br`} />,
          <span
            key={`${keyPrefix}array-close-indent`}
            className="text-muted-foreground"
          >
            {currentIndent}
          </span>,
        );
      }

      elements.push(
        <span key={`${keyPrefix}bracket-close`} className="text-yellow-400">
          ]
        </span>,
      );

      return elements;
    } else {
      const entries = Object.entries(obj);
      const elements = [
        <span key={`${keyPrefix}brace-open`} className="text-yellow-400">
          {"{"}
        </span>,
      ];

      if (entries.length > 0) {
        entries.forEach(([key, value], index) => {
          const entryKey = `${keyPrefix}entry-${index}`;
          elements.push(
            <br key={`${entryKey}-br`} />,
            <span key={`${entryKey}-indent`} className="text-muted-foreground">
              {childIndent}
            </span>,
            <span key={`${entryKey}-key`} className="text-blue-400">
              "{key}"
            </span>,
            <span key={`${entryKey}-colon`} className="text-foreground">
              :
            </span>,
            ...formatJson(value, indent + 1, entryKey),
          );

          if (index < entries.length - 1) {
            elements.push(
              <span key={`${entryKey}-comma`} className="text-foreground">
                ,
              </span>,
            );
          }
        });

        elements.push(
          <br key={`${keyPrefix}object-close-br`} />,
          <span
            key={`${keyPrefix}object-close-indent`}
            className="text-muted-foreground"
          >
            {currentIndent}
          </span>,
        );
      }

      elements.push(
        <span key={`${keyPrefix}brace-close`} className="text-yellow-400">
          {"}"}
        </span>,
      );

      return elements;
    }
  }

  // Primitive values - return single element array
  if (typeof obj === "string") {
    return [
      <span key={`${keyPrefix}string`} className="text-green-400">
        "{obj}"
      </span>,
    ];
  }

  if (typeof obj === "number") {
    return [
      <span key={`${keyPrefix}number`} className="text-orange-400">
        {obj}
      </span>,
    ];
  }

  if (typeof obj === "boolean") {
    return [
      <span key={`${keyPrefix}boolean`} className="text-purple-400">
        {obj.toString()}
      </span>,
    ];
  }

  if (obj === null) {
    return [
      <span key={`${keyPrefix}null`} className="text-red-400">
        null
      </span>,
    ];
  }

  return [];
};

export const JsonViewer: FunctionComponent<{ data: string | unknown }> = ({
  data,
}) => {
  let parsedData: unknown = data;

  if (typeof data === "string") {
    if (!data) return null;
    try {
      parsedData = JSON.parse(data);
    } catch (_) {}
  }

  return (
    <pre className="text-sm font-mono leading-relaxed">
      <code>{formatJson(parsedData)}</code>
    </pre>
  );
};
