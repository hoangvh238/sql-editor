import { exportFieldComment, parseDefault } from "./shared";
import { dbToTypes } from "../../data/datatypes";

// Topological sort to order tables based on foreign key dependencies
const sortTablesByDependencies = (tables, relationships) => {
  const graph = new Map();
  const visited = new Set();
  const sorted = [];

  tables.forEach((table) => {
    graph.set(table.id, []);
  });

  relationships.forEach((rel) => {
    if (graph.has(rel.startTableId)) {
      graph.get(rel.startTableId).push(rel.endTableId);
    }
  });

  const visit = (node) => {
    if (visited.has(node)) return;
    visited.add(node);
    graph.get(node).forEach(visit);
    sorted.push(node);
  };

  graph.forEach((_, node) => visit(node));

  return sorted.map((id) => tables.find((t) => t.id === id));
};

// Export table SQL with inline foreign keys
const exportTableWithForeignKeys = (table, relationships, allTables) => {
  const tableComment = table.comment ? `/**\n${table.comment}\n*/\n` : "";

  const fields = table.fields
    ?.map((field) => {
      if (!field?.name || !field?.type) {
        console.warn("Skipping invalid field:", field);
        return "";
      }

      const fieldComment = exportFieldComment(field.comment);
      const notNull = field.notNull ? "NOT NULL" : "NULL";
      const identity = field.increment ? "IDENTITY(1,1)" : "";
      const unique = field.unique ? "UNIQUE" : "";
      const defaultValue = field.default
        ? `DEFAULT ${parseDefault(field, table.database)}`
        : "";
      const checkConstraint =
        field.check && dbToTypes[table.database]?.[field.type]?.hasCheck
          ? `CHECK(${field.check})`
          : "";

      return `${fieldComment}\t[${field.name}] ${field.type} ${identity} ${notNull} ${unique} ${defaultValue} ${checkConstraint}`.trim();
    })
    .filter(Boolean)
    .join(",\n");

  const primaryKey = table.fields
    ?.filter((f) => f.primary)
    .map((f) => `[${f.name}]`)
    .join(", ");

  const primaryKeySql = primaryKey ? `,\n\tPRIMARY KEY(${primaryKey})` : "";

  const foreignKeys = relationships
    .filter((r) => r.startTableId === table.id)
    .map((r) => {
      const endTable = allTables.find((t) => t.id === r.endTableId);
      const startField = table.fields.find((f) => f.id === r.startFieldId);
      const endField = endTable?.fields.find((f) => f.id === r.endFieldId);

      if (!startField || !endField || !endTable) {
        console.warn("Skipping invalid foreign key:", r);
        return "";
      }

      return `,\n\tCONSTRAINT [${r.name}] FOREIGN KEY([${startField.name}]) REFERENCES [${endTable.name}]([${endField.name}]) ON UPDATE ${r.updateConstraint.toUpperCase()} ON DELETE ${r.deleteConstraint.toUpperCase()}`;
    })
    .filter(Boolean)
    .join("");

  return `${tableComment}CREATE TABLE [${table.name}] (\n${fields}${primaryKeySql}${foreignKeys}\n);`;
};

// Export indices after table creation
const exportIndices = (table) => {
  return table.indices
    ?.map((i) =>
      `CREATE ${i.unique ? "UNIQUE " : ""}INDEX [${i.name}] ON [${table.name}] (${i.fields.map((f) => `[${f}]`).join(", ")});`
    )
    .join("\n") || "";
};

// Main export function
export function toMSSQL(diagram) {
  if (!diagram || !diagram.tables || diagram.tables.length === 0) {
    console.warn("No tables found for export.");
    return "";
  }

  // Sort tables based on foreign key dependencies
  const sortedTables = sortTablesByDependencies(diagram.tables, diagram.relationships);

  // Generate SQL for tables with inline foreign keys and indices
  const tableSql = sortedTables.map((table) => {
    const tableWithFK = exportTableWithForeignKeys(table, diagram.relationships, diagram.tables);
    const indices = exportIndices(table);
    return `${tableWithFK}\n${indices}`;
  }).join("\n");

  return tableSql;
}
