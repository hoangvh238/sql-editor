import { Cardinality, Constraint } from "../../data/constants";
import { parseDefault } from "../exportSQL/shared";

function hasColumnSettings(field) {
  return (
    field.primary ||
    field.notNull ||
    field.increment ||
    (field.comment && field.comment.trim() !== "") ||
    (field.default && field.default.trim() !== "")
  );
}

function columnDefault(field, database) {
  if (!field.default || field.default.trim() === "") return "";
  return `default: ${parseDefault(field, database)}`;
}

function columnComment(field) {
  if (!field.comment || field.comment.trim() === "") return "";
  return `note: '${field.comment}'`;
}

function columnSettings(field, database) {
  if (!hasColumnSettings(field)) return "";
  const settings = [
    field.primary ? "primary key" : "",
    field.increment ? "increment" : "",
    field.notNull ? "not null" : "",
    columnDefault(field, database),
    columnComment(field, database),
  ].filter(Boolean).join(", ");
  return settings ? ` [${settings}]` : "";
}

function ensureVarcharLength(type) {
  // Thêm độ dài mặc định nếu thiếu cho VARCHAR
  return type.toLowerCase().startsWith("varchar") && !type.includes("(")
    ? "varchar(255)"
    : type.toLowerCase();
}

function cardinality(rel) {
  switch (rel.cardinality) {
    case Cardinality.ONE_TO_ONE:
      return "-";
    case Cardinality.ONE_TO_MANY:
      return "<";
    case Cardinality.MANY_TO_ONE:
      return ">";
    default:
      return "-"; // Mặc định là 1-1 nếu không xác định
  }
}

export function toDBML(diagram) {
  const enumSection = diagram.enums
    .map(
      (en) =>
        `enum ${en.name} {\n${en.values.map((v) => `\t${v}`).join("\n")}\n}`,
    )
    .join("\n\n");

  const tableSection = diagram.tables
    .map(
      (table) =>
        `Table ${table.name} {\n${table.fields
          .map(
            (field) =>
              `\t${field.name} ${ensureVarcharLength(field.type)}${columnSettings(
                field,
                diagram.database,
              )}`,
          )
          .join("\n")}${
          table.comment && table.comment.trim() !== ""
            ? `\n\n\tNote: '${table.comment}'`
            : ""
        }\n}`,
    )
    .join("\n\n");

  const relationshipSection = diagram.relationships
    .map(
      (rel) =>
        `Ref ${rel.name} {\n\t${
          diagram.tables[rel.startTableId].name
        }.${diagram.tables[rel.startTableId].fields[rel.startFieldId].name} ${cardinality(
          rel,
        )} ${diagram.tables[rel.endTableId].name}.${
          diagram.tables[rel.endTableId].fields[rel.endFieldId].name
        } [delete: ${rel.deleteConstraint.toLowerCase()}, update: ${rel.updateConstraint.toLowerCase()}]\n}`,
    )
    .join("\n\n");

  return `${enumSection ? enumSection + "\n\n" : ""}${tableSection}${
    relationshipSection ? "\n\n" + relationshipSection : ""
  }`.trim();
}
