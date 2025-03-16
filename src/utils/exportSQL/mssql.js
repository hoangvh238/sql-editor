import { exportFieldComment, parseDefault } from "./shared";
import { dbToTypes } from "../../data/datatypes";

export function toMSSQL(diagram) {
  return `${diagram.tables
    .map((table) => `
${table.comment ? `/**
${table.comment}
*/
` : ""}CREATE TABLE [${table.name}] (
${table.fields
        .map((field) => `	${exportFieldComment(field.comment)}[${field.name}] ${field.type.includes('CHAR') && !field.type.includes('(') ? `${field.type}(255)` : field.type.includes('VARCHAR') && !field.type.includes('(') ? `${field.type}(255)` : field.type}${
          field.notNull ? " NOT NULL" : ""
        }${field.increment ? " IDENTITY" : ""}${
          field.default !== "" ? ` DEFAULT ${parseDefault(field, diagram.database)}` : ""
        }${
          field.check && dbToTypes[diagram.database][field.type]?.hasCheck ? ` CHECK(${field.check})` : ""
        }`)
        .join(",\n")}${
      table.fields.some((f) => f.primary)
        ? `,
	PRIMARY KEY(${table.fields.filter((f) => f.primary).map((f) => `[${f.name}]`).join(", ")})`
        : ""
    }
);`)
    .join("\n")}\n${diagram.relationships
    .map((r) => {
      const parentTable = diagram.tables[r.endTableId];
      const childTable = diagram.tables[r.startTableId];
      const parentField = parentTable.fields.find(f => f.primary);
      const childField = childTable.fields[r.startFieldId];

      return `ALTER TABLE [${childTable.name}]
ADD CONSTRAINT [${r.name}] FOREIGN KEY([${childField.name}]) REFERENCES [${parentTable.name}]([${parentField.name}])
ON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()};`;
    })
    .join("\n")}`;
}
