import { exportFieldComment, parseDefault } from "./shared";
import { dbToTypes } from "../../data/datatypes";

export function toMSSQL(diagram) {
  return `${diagram.tables
    .map(
      (table) =>
        `${table.comment === "" ? "" : `/**\n${table.comment}\n*/\n`}CREATE TABLE [${table.name}] (
${table.fields
          .map(
            (field) =>
              `${exportFieldComment(field.comment)}	[${field.name}] ${field.type}${
                field.notNull ? " NOT NULL" : ""
              }${field.increment ? " IDENTITY" : ""}${
                field.default !== ""
                  ? ` DEFAULT ${parseDefault(field, diagram.database)}`
                  : ""
              }${
                field.check === "" ||
                !dbToTypes[diagram.database][field.type].hasCheck
                  ? ""
                  : ` CHECK(${field.check})`
              }`
          )
          .join(",\n")}${
          table.fields.filter((f) => f.primary).length > 0
            ? `,
	PRIMARY KEY(${table.fields
                .filter((f) => f.primary)
                .map((f) => `[${f.name}]`)
                .join(", ")})`
            : ""
        }
);`
    )
    .join("\n")}
${diagram.relationships
    .map(
      (r) =>
        `ALTER TABLE [${diagram.tables[r.endTableId].name}]
ADD CONSTRAINT [${r.name}] FOREIGN KEY([${diagram.tables[r.endTableId].fields[r.endFieldId].name}]) REFERENCES [${diagram.tables[r.startTableId].name}]([${diagram.tables[r.startTableId].fields[r.startFieldId].name}])
ON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()};`
    )
    .join("\n")}`;
}
