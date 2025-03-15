import { DB } from "../../data/constants";
import { toMariaDB } from "./mariadb";
import { toMSSQL } from "./mssql";
import { toMySQL } from "./mysql";
import { toPostgres } from "./postgres";
import { toSqlite } from "./sqlite";

export function exportSQL(diagram) {

      return toMSSQL(diagram);

}
