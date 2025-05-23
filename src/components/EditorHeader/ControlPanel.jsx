import { useContext, useState } from "react";
import {
  IconCaretdown,
  IconChevronRight,
  IconChevronLeft,
  IconChevronUp,
  IconChevronDown,
  IconSaveStroked,
  IconUndo,
  IconRedo,
  IconEdit,
  IconShareStroked,
} from "@douyinfe/semi-icons";
import { Link, useNavigate } from "react-router-dom";
import icon from "../../assets/icon_dark_64.png";
import {
  Button,
  Divider,
  Dropdown,
  InputNumber,
  Tooltip,
  Spin,
  Toast,
  Popconfirm,
} from "@douyinfe/semi-ui";
import { toPng, toJpeg, toSvg } from "html-to-image";
import {
  jsonToMySQL,
  jsonToPostgreSQL,
  jsonToSQLite,
  jsonToMariaDB,
  jsonToSQLServer,
} from "../../utils/exportSQL/generic";
import {
  ObjectType,
  Action,
  Tab,
  State,
  MODAL,
  SIDESHEET,
  DB,
  IMPORT_FROM,
} from "../../data/constants";
import jsPDF from "jspdf";
import { useHotkeys } from "react-hotkeys-hook";
import { Validator } from "jsonschema";
import { areaSchema, noteSchema, tableSchema } from "../../data/schemas";
import { db } from "../../data/db";
import {
  useLayout,
  useSettings,
  useTransform,
  useDiagram,
  useUndoRedo,
  useSelect,
  useSaveState,
  useTypes,
  useNotes,
  useAreas,
  useEnums,
  useFullscreen,
} from "../../hooks";
import { enterFullscreen, exitFullscreen } from "../../utils/fullscreen";
import { dataURItoBlob } from "../../utils/utils";
import { IconAddArea, IconAddNote, IconAddTable } from "../../icons";
import LayoutDropdown from "./LayoutDropdown";
import Sidesheet from "./SideSheet/Sidesheet";
import Modal from "./Modal/Modal";
import { useTranslation } from "react-i18next";
import { exportSQL } from "../../utils/exportSQL";
import { databases } from "../../data/databases";
import { jsonToMermaid } from "../../utils/exportAs/mermaid";
import { isRtl } from "../../i18n/utils/rtl";
import { jsonToDocumentation } from "../../utils/exportAs/documentation";
import { IdContext } from "../Workspace";
import { socials } from "../../data/socials";
import { toDBML } from "../../utils/exportAs/dbml";

export default function ControlPanel({
  diagramId,
  setDiagramId,
  title,
  setTitle,
  lastSaved,
}) {
  const [modal, setModal] = useState(MODAL.NONE);
  const [sidesheet, setSidesheet] = useState(SIDESHEET.NONE);
  const [showEditName, setShowEditName] = useState(false);
  const [importDb, setImportDb] = useState("");
  const [exportData, setExportData] = useState({
    data: null,
    filename: `${title}_${new Date().toISOString()}`,
    extension: "",
  });
  const [importFrom, setImportFrom] = useState(IMPORT_FROM.JSON);
  const { saveState, setSaveState } = useSaveState();
  const { layout, setLayout } = useLayout();
  const { settings, setSettings } = useSettings();
  const {
    relationships,
    tables,
    setTables,
    addTable,
    updateTable,
    deleteField,
    deleteTable,
    updateField,
    setRelationships,
    addRelationship,
    deleteRelationship,
    updateRelationship,
    database,
  } = useDiagram();
  const { enums, setEnums, deleteEnum, addEnum, updateEnum } = useEnums();
  const { types, addType, deleteType, updateType, setTypes } = useTypes();
  const { notes, setNotes, updateNote, addNote, deleteNote } = useNotes();
  const { areas, setAreas, updateArea, addArea, deleteArea } = useAreas();
  const { undoStack, redoStack, setUndoStack, setRedoStack } = useUndoRedo();
  const { selectedElement, setSelectedElement } = useSelect();
  const { transform, setTransform } = useTransform();
  const { t, i18n } = useTranslation();
  const { setGistId } = useContext(IdContext);
  const navigate = useNavigate();

  const invertLayout = (component) =>
    setLayout((prev) => ({ ...prev, [component]: !prev[component] }));

  const undo = () => {
    if (undoStack.length === 0) return;
    const a = undoStack[undoStack.length - 1];
    setUndoStack((prev) => prev.filter((_, i) => i !== prev.length - 1));
    if (a.action === Action.ADD) {
      if (a.element === ObjectType.TABLE) {
        deleteTable(tables[tables.length - 1].id, false);
      } else if (a.element === ObjectType.AREA) {
        deleteArea(areas[areas.length - 1].id, false);
      } else if (a.element === ObjectType.NOTE) {
        deleteNote(notes[notes.length - 1].id, false);
      } else if (a.element === ObjectType.RELATIONSHIP) {
        deleteRelationship(a.data.id, false);
      } else if (a.element === ObjectType.TYPE) {
        deleteType(types.length - 1, false);
      } else if (a.element === ObjectType.ENUM) {
        deleteEnum(enums.length - 1, false);
      }
      setRedoStack((prev) => [...prev, a]);
    } else if (a.action === Action.MOVE) {
      if (a.element === ObjectType.TABLE) {
        setRedoStack((prev) => [
          ...prev,
          { ...a, x: tables[a.id].x, y: tables[a.id].y },
        ]);
        updateTable(a.id, { x: a.x, y: a.y });
      } else if (a.element === ObjectType.AREA) {
        setRedoStack((prev) => [
          ...prev,
          { ...a, x: areas[a.id].x, y: areas[a.id].y },
        ]);
        updateArea(a.id, { x: a.x, y: a.y });
      } else if (a.element === ObjectType.NOTE) {
        setRedoStack((prev) => [
          ...prev,
          { ...a, x: notes[a.id].x, y: notes[a.id].y },
        ]);
        updateNote(a.id, { x: a.x, y: a.y });
      }
    } else if (a.action === Action.DELETE) {
      if (a.element === ObjectType.TABLE) {
        a.data.relationship.forEach((x) => addRelationship(x, false));
        addTable(a.data.table, false);
      } else if (a.element === ObjectType.RELATIONSHIP) {
        addRelationship(a.data, false);
      } else if (a.element === ObjectType.NOTE) {
        addNote(a.data, false);
      } else if (a.element === ObjectType.AREA) {
        addArea(a.data, false);
      } else if (a.element === ObjectType.TYPE) {
        addType({ id: a.id, ...a.data }, false);
      } else if (a.element === ObjectType.ENUM) {
        addEnum({ id: a.id, ...a.data }, false);
      }
      setRedoStack((prev) => [...prev, a]);
    } else if (a.action === Action.EDIT) {
      if (a.element === ObjectType.AREA) {
        updateArea(a.aid, a.undo);
      } else if (a.element === ObjectType.NOTE) {
        updateNote(a.nid, a.undo);
      } else if (a.element === ObjectType.TABLE) {
        if (a.component === "field") {
          updateField(a.tid, a.fid, a.undo);
        } else if (a.component === "field_delete") {
          setRelationships((prev) => {
            let temp = [...prev];
            a.data.relationship.forEach((r) => {
              temp.splice(r.id, 0, r);
            });
            temp = temp.map((e, i) => {
              const recoveredRel = a.data.relationship.find(
                (x) =>
                  (x.startTableId === e.startTableId &&
                    x.startFieldId === e.startFieldId) ||
                  (x.endTableId === e.endTableId &&
                    x.endFieldId === a.endFieldId),
              );
              if (
                e.startTableId === a.tid &&
                e.startFieldId >= a.data.field.id &&
                !recoveredRel
              ) {
                return {
                  ...e,
                  id: i,
                  startFieldId: e.startFieldId + 1,
                };
              }
              if (
                e.endTableId === a.tid &&
                e.endFieldId >= a.data.field.id &&
                !recoveredRel
              ) {
                return {
                  ...e,
                  id: i,
                  endFieldId: e.endFieldId + 1,
                };
              }
              return { ...e, id: i };
            });
            return temp;
          });
          setTables((prev) =>
            prev.map((t) => {
              if (t.id === a.tid) {
                const temp = t.fields.slice();
                temp.splice(a.data.field.id, 0, a.data.field);
                return { ...t, fields: temp.map((t, i) => ({ ...t, id: i })) };
              }
              return t;
            }),
          );
        } else if (a.component === "field_add") {
          updateTable(a.tid, {
            fields: tables[a.tid].fields
              .filter((e) => e.id !== tables[a.tid].fields.length - 1)
              .map((t, i) => ({ ...t, id: i })),
          });
        } else if (a.component === "index_add") {
          updateTable(a.tid, {
            indices: tables[a.tid].indices
              .filter((e) => e.id !== tables[a.tid].indices.length - 1)
              .map((t, i) => ({ ...t, id: i })),
          });
        } else if (a.component === "index") {
          updateTable(a.tid, {
            indices: tables[a.tid].indices.map((index) =>
              index.id === a.iid
                ? {
                    ...index,
                    ...a.undo,
                  }
                : index,
            ),
          });
        } else if (a.component === "index_delete") {
          setTables((prev) =>
            prev.map((table) => {
              if (table.id === a.tid) {
                const temp = table.indices.slice();
                temp.splice(a.data.id, 0, a.data);
                return {
                  ...table,
                  indices: temp.map((t, i) => ({ ...t, id: i })),
                };
              }
              return table;
            }),
          );
        } else if (a.component === "self") {
          updateTable(a.tid, a.undo);
        }
      } else if (a.element === ObjectType.RELATIONSHIP) {
        updateRelationship(a.rid, a.undo);
      } else if (a.element === ObjectType.TYPE) {
        if (a.component === "field_add") {
          updateType(a.tid, {
            fields: types[a.tid].fields.filter(
              (_, i) => i !== types[a.tid].fields.length - 1,
            ),
          });
        }
        if (a.component === "field") {
          updateType(a.tid, {
            fields: types[a.tid].fields.map((e, i) =>
              i === a.fid ? { ...e, ...a.undo } : e,
            ),
          });
        } else if (a.component === "field_delete") {
          setTypes((prev) =>
            prev.map((t, i) => {
              if (i === a.tid) {
                const temp = t.fields.slice();
                temp.splice(a.fid, 0, a.data);
                return { ...t, fields: temp };
              }
              return t;
            }),
          );
        } else if (a.component === "self") {
          updateType(a.tid, a.undo);
          if (a.updatedFields) {
            if (a.undo.name) {
              a.updatedFields.forEach((x) =>
                updateField(x.tid, x.fid, { type: a.undo.name.toUpperCase() }),
              );
            }
          }
        }
      } else if (a.element === ObjectType.ENUM) {
        updateEnum(a.id, a.undo);
        if (a.updatedFields) {
          if (a.undo.name) {
            a.updatedFields.forEach((x) =>
              updateField(x.tid, x.fid, { type: a.undo.name.toUpperCase() }),
            );
          }
        }
      }
      setRedoStack((prev) => [...prev, a]);
    } else if (a.action === Action.PAN) {
      setTransform((prev) => ({
        ...prev,
        pan: a.undo,
      }));
      setRedoStack((prev) => [...prev, a]);
    }
  };

  const redo = () => {
    if (redoStack.length === 0) return;
    const a = redoStack[redoStack.length - 1];
    setRedoStack((prev) => prev.filter((e, i) => i !== prev.length - 1));
    if (a.action === Action.ADD) {
      if (a.element === ObjectType.TABLE) {
        addTable(null, false);
      } else if (a.element === ObjectType.AREA) {
        addArea(null, false);
      } else if (a.element === ObjectType.NOTE) {
        addNote(null, false);
      } else if (a.element === ObjectType.RELATIONSHIP) {
        addRelationship(a.data, false);
      } else if (a.element === ObjectType.TYPE) {
        addType(null, false);
      } else if (a.element === ObjectType.ENUM) {
        addEnum(null, false);
      }
      setUndoStack((prev) => [...prev, a]);
    } else if (a.action === Action.MOVE) {
      if (a.element === ObjectType.TABLE) {
        setUndoStack((prev) => [
          ...prev,
          { ...a, x: tables[a.id].x, y: tables[a.id].y },
        ]);
        updateTable(a.id, { x: a.x, y: a.y });
      } else if (a.element === ObjectType.AREA) {
        setUndoStack((prev) => [
          ...prev,
          { ...a, x: areas[a.id].x, y: areas[a.id].y },
        ]);
        updateArea(a.id, { x: a.x, y: a.y });
      } else if (a.element === ObjectType.NOTE) {
        setUndoStack((prev) => [
          ...prev,
          { ...a, x: notes[a.id].x, y: notes[a.id].y },
        ]);
        updateNote(a.id, { x: a.x, y: a.y });
      }
    } else if (a.action === Action.DELETE) {
      if (a.element === ObjectType.TABLE) {
        deleteTable(a.data.table.id, false);
      } else if (a.element === ObjectType.RELATIONSHIP) {
        deleteRelationship(a.data.id, false);
      } else if (a.element === ObjectType.NOTE) {
        deleteNote(a.data.id, false);
      } else if (a.element === ObjectType.AREA) {
        deleteArea(a.data.id, false);
      } else if (a.element === ObjectType.TYPE) {
        deleteType(a.id, false);
      } else if (a.element === ObjectType.ENUM) {
        deleteEnum(a.id, false);
      }
      setUndoStack((prev) => [...prev, a]);
    } else if (a.action === Action.EDIT) {
      if (a.element === ObjectType.AREA) {
        updateArea(a.aid, a.redo);
      } else if (a.element === ObjectType.NOTE) {
        updateNote(a.nid, a.redo);
      } else if (a.element === ObjectType.TABLE) {
        if (a.component === "field") {
          updateField(a.tid, a.fid, a.redo);
        } else if (a.component === "field_delete") {
          deleteField(a.data.field, a.tid, false);
        } else if (a.component === "field_add") {
          updateTable(a.tid, {
            fields: [
              ...tables[a.tid].fields,
              {
                name: "",
                type: "",
                default: "",
                check: "",
                primary: false,
                unique: false,
                notNull: false,
                increment: false,
                comment: "",
                id: tables[a.tid].fields.length,
              },
            ],
          });
        } else if (a.component === "index_add") {
          setTables((prev) =>
            prev.map((table) => {
              if (table.id === a.tid) {
                return {
                  ...table,
                  indices: [
                    ...table.indices,
                    {
                      id: table.indices.length,
                      name: `index_${table.indices.length}`,
                      fields: [],
                    },
                  ],
                };
              }
              return table;
            }),
          );
        } else if (a.component === "index") {
          updateTable(a.tid, {
            indices: tables[a.tid].indices.map((index) =>
              index.id === a.iid
                ? {
                    ...index,
                    ...a.redo,
                  }
                : index,
            ),
          });
        } else if (a.component === "index_delete") {
          updateTable(a.tid, {
            indices: tables[a.tid].indices
              .filter((e) => e.id !== a.data.id)
              .map((t, i) => ({ ...t, id: i })),
          });
        } else if (a.component === "self") {
          updateTable(a.tid, a.redo, false);
        }
      } else if (a.element === ObjectType.RELATIONSHIP) {
        updateRelationship(a.rid, a.redo);
      } else if (a.element === ObjectType.TYPE) {
        if (a.component === "field_add") {
          updateType(a.tid, {
            fields: [
              ...types[a.tid].fields,
              {
                name: "",
                type: "",
              },
            ],
          });
        } else if (a.component === "field") {
          updateType(a.tid, {
            fields: types[a.tid].fields.map((e, i) =>
              i === a.fid ? { ...e, ...a.redo } : e,
            ),
          });
        } else if (a.component === "field_delete") {
          updateType(a.tid, {
            fields: types[a.tid].fields.filter((field, i) => i !== a.fid),
          });
        } else if (a.component === "self") {
          updateType(a.tid, a.redo);
          if (a.updatedFields) {
            if (a.redo.name) {
              a.updatedFields.forEach((x) =>
                updateField(x.tid, x.fid, { type: a.redo.name.toUpperCase() }),
              );
            }
          }
        }
      } else if (a.element === ObjectType.ENUM) {
        updateEnum(a.id, a.redo);
        if (a.updatedFields) {
          if (a.redo.name) {
            a.updatedFields.forEach((x) =>
              updateField(x.tid, x.fid, { type: a.redo.name.toUpperCase() }),
            );
          }
        }
      }
      setUndoStack((prev) => [...prev, a]);
    } else if (a.action === Action.PAN) {
      setTransform((prev) => ({
        ...prev,
        pan: a.redo,
      }));
      setUndoStack((prev) => [...prev, a]);
    }
  };

  const fileImport = () => setModal(MODAL.IMPORT);
  const viewGrid = () =>
    setSettings((prev) => ({ ...prev, showGrid: !prev.showGrid }));
  const zoomIn = () =>
    setTransform((prev) => ({ ...prev, zoom: prev.zoom * 1.2 }));
  const zoomOut = () =>
    setTransform((prev) => ({ ...prev, zoom: prev.zoom / 1.2 }));
  const viewStrictMode = () => {
    setSettings((prev) => ({ ...prev, strictMode: !prev.strictMode }));
  };
  const viewFieldSummary = () => {
    setSettings((prev) => ({
      ...prev,
      showFieldSummary: !prev.showFieldSummary,
    }));
  };
  const copyAsImage = () => {
    toPng(document.getElementById("canvas")).then(function (dataUrl) {
      const blob = dataURItoBlob(dataUrl);
      navigator.clipboard
        .write([new ClipboardItem({ "image/png": blob })])
        .then(() => {
          Toast.success(t("copied_to_clipboard"));
        })
        .catch(() => {
          Toast.error(t("oops_smth_went_wrong"));
        });
    });
  };
  const resetView = () =>
    setTransform((prev) => ({ ...prev, zoom: 1, pan: { x: 0, y: 0 } }));
  const fitWindow = () => {
    const diagram = document.getElementById("diagram").getBoundingClientRect();
    const canvas = document.getElementById("canvas").getBoundingClientRect();

    const scaleX = canvas.width / diagram.width;
    const scaleY = canvas.height / diagram.height;
    const scale = Math.min(scaleX, scaleY);
    const translateX = canvas.left;
    const translateY = canvas.top;

    setTransform((prev) => ({
      ...prev,
      zoom: scale - 0.01,
      pan: { x: translateX, y: translateY },
    }));
  };
  const edit = () => {
    if (selectedElement.element === ObjectType.TABLE) {
      if (!layout.sidebar) {
        setSelectedElement((prev) => ({
          ...prev,
          open: true,
        }));
      } else {
        setSelectedElement((prev) => ({
          ...prev,
          open: true,
          currentTab: Tab.TABLES,
        }));
        if (selectedElement.currentTab !== Tab.TABLES) return;
        document
          .getElementById(`scroll_table_${selectedElement.id}`)
          .scrollIntoView({ behavior: "smooth" });
      }
    } else if (selectedElement.element === ObjectType.AREA) {
      if (layout.sidebar) {
        setSelectedElement((prev) => ({
          ...prev,
          currentTab: Tab.AREAS,
        }));
        if (selectedElement.currentTab !== Tab.AREAS) return;
        document
          .getElementById(`scroll_area_${selectedElement.id}`)
          .scrollIntoView({ behavior: "smooth" });
      } else {
        setSelectedElement((prev) => ({
          ...prev,
          open: true,
          editFromToolbar: true,
        }));
      }
    } else if (selectedElement.element === ObjectType.NOTE) {
      if (layout.sidebar) {
        setSelectedElement((prev) => ({
          ...prev,
          currentTab: Tab.NOTES,
          open: false,
        }));
        if (selectedElement.currentTab !== Tab.NOTES) return;
        document
          .getElementById(`scroll_note_${selectedElement.id}`)
          .scrollIntoView({ behavior: "smooth" });
      } else {
        setSelectedElement((prev) => ({
          ...prev,
          open: true,
          editFromToolbar: true,
        }));
      }
    }
  };
  const del = () => {
    switch (selectedElement.element) {
      case ObjectType.TABLE:
        deleteTable(selectedElement.id);
        break;
      case ObjectType.NOTE:
        deleteNote(selectedElement.id);
        break;
      case ObjectType.AREA:
        deleteArea(selectedElement.id);
        break;
      default:
        break;
    }
  };
  const duplicate = () => {
    switch (selectedElement.element) {
      case ObjectType.TABLE:
        addTable({
          ...tables[selectedElement.id],
          x: tables[selectedElement.id].x + 20,
          y: tables[selectedElement.id].y + 20,
          id: tables.length,
        });
        break;
      case ObjectType.NOTE:
        addNote({
          ...notes[selectedElement.id],
          x: notes[selectedElement.id].x + 20,
          y: notes[selectedElement.id].y + 20,
          id: notes.length,
        });
        break;
      case ObjectType.AREA:
        addArea({
          ...areas[selectedElement.id],
          x: areas[selectedElement.id].x + 20,
          y: areas[selectedElement.id].y + 20,
          id: areas.length,
        });
        break;
      default:
        break;
    }
  };
  const copy = () => {
    switch (selectedElement.element) {
      case ObjectType.TABLE:
        navigator.clipboard
          .writeText(JSON.stringify({ ...tables[selectedElement.id] }))
          .catch(() => Toast.error(t("oops_smth_went_wrong")));
        break;
      case ObjectType.NOTE:
        navigator.clipboard
          .writeText(JSON.stringify({ ...notes[selectedElement.id] }))
          .catch(() => Toast.error(t("oops_smth_went_wrong")));
        break;
      case ObjectType.AREA:
        navigator.clipboard
          .writeText(JSON.stringify({ ...areas[selectedElement.id] }))
          .catch(() => Toast.error(t("oops_smth_went_wrong")));
        break;
      default:
        break;
    }
  };
  const paste = () => {
    navigator.clipboard.readText().then((text) => {
      let obj = null;
      try {
        obj = JSON.parse(text);
      } catch (error) {
        return;
      }
      const v = new Validator();
      if (v.validate(obj, tableSchema).valid) {
        addTable({
          ...obj,
          x: obj.x + 20,
          y: obj.y + 20,
          id: tables.length,
        });
      } else if (v.validate(obj, areaSchema).valid) {
        addArea({
          ...obj,
          x: obj.x + 20,
          y: obj.y + 20,
          id: areas.length,
        });
      } else if (v.validate(obj, noteSchema)) {
        addNote({
          ...obj,
          x: obj.x + 20,
          y: obj.y + 20,
          id: notes.length,
        });
      }
    });
  };
  const cut = () => {
    copy();
    del();
  };
  const save = () => setSaveState(State.SAVING);
  const open = () => setModal(MODAL.OPEN);
  const saveDiagramAs = () => setModal(MODAL.SAVEAS);
  const fullscreen = useFullscreen();

  const menu = {
    file: {
      import_from_source: {
        ...(database === DB.GENERIC && {
          children: [
            {
              MSSQL: () => {
                setModal(MODAL.IMPORT_SRC);
                setImportDb(DB.MSSQL);
              },
            },
          ],
        }),
        function: () => {
          if (database === DB.GENERIC) return;

          setModal(MODAL.IMPORT_SRC);
        },
      },
    },
    edit: {
      undo: {
        function: undo,
        shortcut: "Ctrl+Z",
      },
      redo: {
        function: redo,
        shortcut: "Ctrl+Y",
      },
      clear: {
        warning: {
          title: t("clear"),
          message: t("are_you_sure_clear"),
        },
        function: () => {
          setTables([]);
          setRelationships([]);
          setAreas([]);
          setNotes([]);
          setEnums([]);
          setTypes([]);
          setUndoStack([]);
          setRedoStack([]);
        },
      },
      edit: {
        function: edit,
        shortcut: "Ctrl+E",
      },
      cut: {
        function: cut,
        shortcut: "Ctrl+X",
      },
      copy: {
        function: copy,
        shortcut: "Ctrl+C",
      },
      paste: {
        function: paste,
        shortcut: "Ctrl+V",
      },
      duplicate: {
        function: duplicate,
        shortcut: "Ctrl+D",
      },
      delete: {
        function: del,
        shortcut: "Del",
      },
      copy_as_image: {
        function: copyAsImage,
        shortcut: "Ctrl+Alt+C",
      },
    },
    view: {
      sidebar: {
        state: layout.sidebar ? (
          <i className="bi bi-toggle-on" />
        ) : (
          <i className="bi bi-toggle-off" />
        ),
        function: () =>
          setLayout((prev) => ({ ...prev, sidebar: !prev.sidebar })),
      },
      issues: {
        state: layout.issues ? (
          <i className="bi bi-toggle-on" />
        ) : (
          <i className="bi bi-toggle-off" />
        ),
        function: () =>
          setLayout((prev) => ({ ...prev, issues: !prev.issues })),
      },
      strict_mode: {
        state: settings.strictMode ? (
          <i className="bi bi-toggle-off" />
        ) : (
          <i className="bi bi-toggle-on" />
        ),
        function: viewStrictMode,
        shortcut: "Ctrl+Shift+M",
      },
      presentation_mode: {
        function: () => {
          setLayout((prev) => ({
            ...prev,
            header: false,
            sidebar: false,
            toolbar: false,
          }));
          enterFullscreen();
        },
      },
      field_details: {
        state: settings.showFieldSummary ? (
          <i className="bi bi-toggle-on" />
        ) : (
          <i className="bi bi-toggle-off" />
        ),
        function: viewFieldSummary,
        shortcut: "Ctrl+Shift+F",
      },
      reset_view: {
        function: resetView,
        shortcut: "Ctrl+R",
      },
      show_grid: {
        state: settings.showGrid ? (
          <i className="bi bi-toggle-on" />
        ) : (
          <i className="bi bi-toggle-off" />
        ),
        function: viewGrid,
        shortcut: "Ctrl+Shift+G",
      },
      show_relationship_labels: {
        state: settings.showRelationshipLabels ? (
          <i className="bi bi-toggle-on" />
        ) : (
          <i className="bi bi-toggle-off" />
        ),
        function: () =>
          setSettings((prev) => ({
            ...prev,
            showRelationshipLabels: !prev.showRelationshipLabels,
          })),
      },
      theme: {
        children: [
          {
            light: () => {
              const body = document.body;
              if (body.hasAttribute("theme-mode")) {
                body.setAttribute("theme-mode", "light");
              }
              localStorage.setItem("theme", "light");
              setSettings((prev) => ({ ...prev, mode: "light" }));
            },
          },
          {
            dark: () => {
              const body = document.body;
              if (body.hasAttribute("theme-mode")) {
                body.setAttribute("theme-mode", "dark");
              }
              localStorage.setItem("theme", "dark");
              setSettings((prev) => ({ ...prev, mode: "dark" }));
            },
          },
        ],
        function: () => {},
      },
      zoom_in: {
        function: zoomIn,
        shortcut: "Ctrl+(Up/Wheel)",
      },
      zoom_out: {
        function: zoomOut,
        shortcut: "Ctrl+(Down/Wheel)",
      },
      fullscreen: {
        state: fullscreen ? (
          <i className="bi bi-toggle-on" />
        ) : (
          <i className="bi bi-toggle-off" />
        ),
        function: fullscreen ? exitFullscreen : enterFullscreen,
      },
    },
    settings: {
      table_width: {
        function: () => setModal(MODAL.TABLE_WIDTH),
      },
    }
  };

  useHotkeys("ctrl+i, meta+i", fileImport, { preventDefault: true });
  useHotkeys("ctrl+z, meta+z", undo, { preventDefault: true });
  useHotkeys("ctrl+y, meta+y", redo, { preventDefault: true });
  useHotkeys("ctrl+s, meta+s", save, { preventDefault: true });
  useHotkeys("ctrl+o, meta+o", open, { preventDefault: true });
  useHotkeys("ctrl+e, meta+e", edit, { preventDefault: true });
  useHotkeys("ctrl+d, meta+d", duplicate, { preventDefault: true });
  useHotkeys("ctrl+c, meta+c", copy, { preventDefault: true });
  useHotkeys("ctrl+v, meta+v", paste, { preventDefault: true });
  useHotkeys("ctrl+x, meta+x", cut, { preventDefault: true });
  useHotkeys("delete", del, { preventDefault: true });
  useHotkeys("ctrl+shift+g, meta+shift+g", viewGrid, { preventDefault: true });
  useHotkeys("ctrl+up, meta+up", zoomIn, { preventDefault: true });
  useHotkeys("ctrl+down, meta+down", zoomOut, { preventDefault: true });
  useHotkeys("ctrl+shift+m, meta+shift+m", viewStrictMode, {
    preventDefault: true,
  });
  useHotkeys("ctrl+shift+f, meta+shift+f", viewFieldSummary, {
    preventDefault: true,
  });
  useHotkeys("ctrl+shift+s, meta+shift+s", saveDiagramAs, {
    preventDefault: true,
  });
  useHotkeys("ctrl+alt+c, meta+alt+c", copyAsImage, { preventDefault: true });
  useHotkeys("ctrl+r, meta+r", resetView, { preventDefault: true });
  useHotkeys("ctrl+h, meta+h", () => window.open(socials.docs, "_blank"), {
    preventDefault: true,
  });
  useHotkeys("ctrl+alt+w, meta+alt+w", fitWindow, { preventDefault: true });

  return (
    <>
      <div>
        {layout.header && (
          <div
            className="flex justify-between items-center me-7"
            style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
          >
            {header()}
           
          </div>
        )}
        {layout.toolbar && toolbar()}
      </div>
      <Modal
        modal={modal}
        exportData={exportData}
        setExportData={setExportData}
        title={title}
        setTitle={setTitle}
        setDiagramId={setDiagramId}
        setModal={setModal}
        importFrom={importFrom}
        importDb={importDb}
      />
      <Sidesheet
        type={sidesheet}
        onClose={() => setSidesheet(SIDESHEET.NONE)}
      />
    </>
  );

  function toolbar() {
    return (
      <div
        className="py-1.5 px-5 flex justify-between items-center rounded-xl my-1 sm:mx-1 xl:mx-6 select-none overflow-hidden toolbar-theme"
        style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
      >
        <div className="flex justify-start items-center">
          <LayoutDropdown />
          <Divider layout="vertical" margin="8px" />
          <Dropdown
            style={{ width: "240px" }}
            position={isRtl(i18n.language) ? "bottomRight" : "bottomLeft"}
            render={
              <Dropdown.Menu
                style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
              >
                <Dropdown.Item
                  onClick={fitWindow}
                  style={{ display: "flex", justifyContent: "space-between" }}
                >
                  <div>{t("fit_window_reset")}</div>
                  <div className="text-gray-400">Ctrl+Alt+W</div>
                </Dropdown.Item>
                <Dropdown.Divider />
                {[0.25, 0.5, 0.75, 1.0, 1.25, 1.5, 2.0, 3.0].map((e, i) => (
                  <Dropdown.Item
                    key={i}
                    onClick={() => {
                      setTransform((prev) => ({ ...prev, zoom: e }));
                    }}
                  >
                    {Math.floor(e * 100)}%
                  </Dropdown.Item>
                ))}
                <Dropdown.Divider />
                <Dropdown.Item>
                  <InputNumber
                    field="zoom"
                    label={t("zoom")}
                    placeholder={t("zoom")}
                    suffix={<div className="p-1">%</div>}
                    onChange={(v) =>
                      setTransform((prev) => ({
                        ...prev,
                        zoom: parseFloat(v) * 0.01,
                      }))
                    }
                  />
                </Dropdown.Item>
              </Dropdown.Menu>
            }
            trigger="click"
          >
            <div className="py-1 px-2 hover-2 rounded flex items-center justify-center">
              <div className="w-[40px]">
                {Math.floor(transform.zoom * 100)}%
              </div>
              <div>
                <IconCaretdown />
              </div>
            </div>
          </Dropdown>
          <Tooltip content={t("zoom_in")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded text-lg"
              onClick={() =>
                setTransform((prev) => ({ ...prev, zoom: prev.zoom * 1.2 }))
              }
            >
              <i className="fa-solid fa-magnifying-glass-plus" />
            </button>
          </Tooltip>
          <Tooltip content={t("zoom_out")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded text-lg"
              onClick={() =>
                setTransform((prev) => ({ ...prev, zoom: prev.zoom / 1.2 }))
              }
            >
              <i className="fa-solid fa-magnifying-glass-minus" />
            </button>
          </Tooltip>
          <Divider layout="vertical" margin="8px" />
          <Tooltip content={t("undo")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded flex items-center"
              onClick={undo}
            >
              <IconUndo
                size="large"
                style={{ color: undoStack.length === 0 ? "#9598a6" : "" }}
              />
            </button>
          </Tooltip>
          <Tooltip content={t("redo")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded flex items-center"
              onClick={redo}
            >
              <IconRedo
                size="large"
                style={{ color: redoStack.length === 0 ? "#9598a6" : "" }}
              />
            </button>
          </Tooltip>
          <Divider layout="vertical" margin="8px" />
          <Tooltip content={t("add_table")} position="bottom">
            <button
              className="flex items-center py-1 px-2 hover-2 rounded"
              onClick={() => addTable()}
            >
              <IconAddTable />
            </button>
          </Tooltip>
          <Tooltip content={t("add_area")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded flex items-center"
              onClick={() => addArea()}
            >
              <IconAddArea />
            </button>
          </Tooltip>
          <Tooltip content={t("add_note")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded flex items-center"
              onClick={() => addNote()}
            >
              <IconAddNote />
            </button>
          </Tooltip>
          <Tooltip content={t("theme")} position="bottom">
            <button
              className="py-1 px-2 hover-2 rounded text-xl -mt-0.5"
              onClick={() => {
                const body = document.body;
                if (body.hasAttribute("theme-mode")) {
                  if (body.getAttribute("theme-mode") === "light") {
                    menu["view"]["theme"].children[1]["dark"]();
                  } else {
                    menu["view"]["theme"].children[0]["light"]();
                  }
                }
              }}
            >
              <i className="fa-solid fa-circle-half-stroke" />
            </button>
          </Tooltip>
        </div>
        <button
          onClick={() => invertLayout("header")}
          className="flex items-center"
        >
          {layout.header ? <IconChevronUp /> : <IconChevronDown />}
        </button>
      </div>
    );
  }

  function getState() {
    switch (saveState) {
      case State.NONE:
        return t("no_changes");
      case State.LOADING:
        return t("loading");
      case State.SAVED:
        return `${t("last_saved")} ${lastSaved}`;
      case State.SAVING:
        return t("saving");
      case State.ERROR:
        return t("failed_to_save");
      case State.FAILED_TO_LOAD:
        return t("failed_to_load");
      default:
        return "";
    }
  }

  function header() {
    return (
      <nav
        className="flex justify-between pt-1 items-center whitespace-nowrap"
        style={isRtl(i18n.language) ? { direction: "rtl" } : {}}
      >
        <div className="flex justify-start items-center">
         
          <div className="ms-1 mt-1">
            <div className="flex items-center ms-3 gap-2">
              {databases[database].image && (
                <img
                  src={databases[database].image}
                  className="h-5"
                  style={{
                    filter:
                      "opacity(0.4) drop-shadow(0 0 0 white) drop-shadow(0 0 0 white)",
                  }}
                  alt={databases[database].name + " icon"}
                  title={databases[database].name + " diagram"}
                />
              )}

              {(showEditName || modal === MODAL.RENAME) && <IconEdit />}
            </div>
            <div className="flex justify-between items-center">
              <div className="flex justify-start text-md select-none me-2">
                {Object.keys(menu).map((category) => (
                  <Dropdown
                    key={category}
                    position="bottomLeft"
                    style={{
                      width: "240px",
                      direction: isRtl(i18n.language) ? "rtl" : "ltr",
                    }}
                    render={
                      <Dropdown.Menu>
                        {Object.keys(menu[category]).map((item, index) => {
                          if (menu[category][item].children) {
                            return (
                              <Dropdown
                                style={{ width: "120px" }}
                                key={item}
                                position="rightTop"
                                render={
                                  <Dropdown.Menu>
                                    {menu[category][item].children.map(
                                      (e, i) => (
                                        <Dropdown.Item
                                          key={i}
                                          onClick={Object.values(e)[0]}
                                        >
                                          {t(Object.keys(e)[0])}
                                        </Dropdown.Item>
                                      ),
                                    )}
                                  </Dropdown.Menu>
                                }
                              >
                                <Dropdown.Item
                                  style={{
                                    display: "flex",
                                    justifyContent: "space-between",
                                    alignItems: "center",
                                  }}
                                  onClick={menu[category][item].function}
                                >
                                  {t(item)}

                                  {isRtl(i18n.language) ? (
                                    <IconChevronLeft />
                                  ) : (
                                    <IconChevronRight />
                                  )}
                                </Dropdown.Item>
                              </Dropdown>
                            );
                          }
                          if (menu[category][item].warning) {
                            return (
                              <Popconfirm
                                key={index}
                                title={menu[category][item].warning.title}
                                content={menu[category][item].warning.message}
                                onConfirm={menu[category][item].function}
                                position="right"
                                okText={t("confirm")}
                                cancelText={t("cancel")}
                              >
                                <Dropdown.Item>{t(item)}</Dropdown.Item>
                              </Popconfirm>
                            );
                          }
                          return (
                            <Dropdown.Item
                              key={index}
                              onClick={menu[category][item].function}
                              style={
                                menu[category][item].shortcut && {
                                  display: "flex",
                                  justifyContent: "space-between",
                                  alignItems: "center",
                                }
                              }
                            >
                              <div className="w-full flex items-center justify-between">
                                <div>{t(item)}</div>
                                <div className="flex items-center gap-1">
                                  {menu[category][item].shortcut && (
                                    <div className="text-gray-400">
                                      {menu[category][item].shortcut}
                                    </div>
                                  )}
                                  {menu[category][item].state &&
                                    menu[category][item].state}
                                </div>
                              </div>
                            </Dropdown.Item>
                          );
                        })}
                      </Dropdown.Menu>
                    }
                  >
                    <div className="px-3 py-1 hover-2 rounded">
                      {t(category)}
                    </div>
                  </Dropdown>
                ))}
              </div>
            </div>
          </div>
        </div>
      </nav>
    );
  }
}
