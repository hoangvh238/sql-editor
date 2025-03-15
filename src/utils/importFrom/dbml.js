import { Parser } from "@dbml/core";
import { arrangeTables } from "../arrangeTables";
import { Cardinality, Constraint } from "../../data/constants";

const parser = new Parser();

export function fromDBML(src) {
  // Kiểm tra đầu vào
  if (typeof src !== "string" || src.trim() === "") {
    throw new Error("Invalid input: DBML source must be a non-empty string.");
  }

  let ast;
  try {
    ast = parser.parse(src, "dbml");
  } catch (error) {
    const errorMsg = error.diags?.[0]
      ? `${error.diags[0].name} [Ln ${error.diags[0].location.start.line}, Col ${error.diags[0].location.start.column}]: ${error.diags[0].message}`
      : error.message || "Unknown parsing error";
    console.error("❌ Error parsing DBML string:", errorMsg);
    throw new Error(`Invalid DBML format: ${errorMsg}`);
  }

  const tables = [];
  const enums = [];
  const relationships = [];

  // Xử lý trường hợp không có schema
  if (!ast.schemas || ast.schemas.length === 0) {
    console.warn("⚠️ No schemas found in DBML input.");
    const diagram = { tables, enums, relationships };
    arrangeTables(diagram);
    return diagram;
  }

  for (const schema of ast.schemas) {
    // Xử lý bảng
    for (const table of schema.tables || []) {
      const parsedTable = {
        id: tables.length,
        name: table.name,
        comment: table.note ?? "",
        color: "#175e7a",
        fields: (table.fields || []).map((column, idx) => ({
          id: idx,
          name: column.name,
          type: column.type?.type_name.toUpperCase() || "UNKNOWN",
          default: column.dbdefault ?? "",
          check: column.check ?? "",
          primary: !!column.pk,
          unique: !!column.unique,
          notNull: !!column.not_null,
          increment: !!column.increment,
          comment: column.note ?? "",
        })),
        indices: (table.indexes || []).map((idx, idxId) => ({
          id: idxId,
          fields: idx.columns.map((x) => x.value),
          name: idx.name ?? `${table.name}_index_${idxId}`,
          unique: !!idx.unique,
        })),
      };
      tables.push(parsedTable);
    }

    // Xử lý quan hệ
    for (const ref of schema.refs || []) {
      const [start, end] = ref.endpoints || [];

      const startTableId = tables.findIndex((t) => t.name === start?.tableName);
      const endTableId = tables.findIndex((t) => t.name === end?.tableName);

      if (startTableId === -1 || endTableId === -1) {
        console.warn("⚠️ Skipping relationship: Table not found:", start?.tableName, end?.tableName);
        continue;
      }

      const startFieldId = tables[startTableId].fields.findIndex((f) => f.name === start?.fieldNames?.[0]);
      const endFieldId = tables[endTableId].fields.findIndex((f) => f.name === end?.fieldNames?.[0]);

      if (startFieldId === -1 || endFieldId === -1) {
        console.warn("⚠️ Skipping relationship: Field not found:", start?.fieldNames?.[0], end?.fieldNames?.[0]);
        continue;
      }

      const relationship = {
        name: ref.name || `fk_${start.tableName}_${start.fieldNames[0]}_${end.tableName}`,
        startTableId,
        endTableId,
        startFieldId,
        endFieldId,
        id: relationships.length,
        updateConstraint: ref.onUpdate ? ref.onUpdate.toUpperCase() : Constraint.NONE,
        deleteConstraint: ref.onDelete ? ref.onDelete.toUpperCase() : Constraint.NONE,
        cardinality: getCardinality(start?.relation, end?.relation),
      };

      relationships.push(relationship);
    }

    // Xử lý enums
    for (const schemaEnum of schema.enums || []) {
      enums.push({
        name: schemaEnum.name,
        values: schemaEnum.values.map((x) => x.name),
      });
    }
  }

  const diagram = { tables, enums, relationships };
  arrangeTables(diagram);
  return diagram;
}

function getCardinality(startRelation, endRelation) {
  if (startRelation === "*" && endRelation === "1") return Cardinality.MANY_TO_ONE;
  if (startRelation === "1" && endRelation === "*") return Cardinality.ONE_TO_MANY;
  if (startRelation === "1" && endRelation === "1") return Cardinality.ONE_TO_ONE;
  return Cardinality.ONE_TO_ONE; // Mặc định nếu không xác định
}