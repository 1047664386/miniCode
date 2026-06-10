import { createRequire as __cr } from 'module';
import { fileURLToPath as __ftu } from 'url';
import { dirname as __dn } from 'path';
const require = __cr(import.meta.url);
const __filename = __ftu(import.meta.url);
const __dirname = __dn(__filename);
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
  get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
}) : x)(function(x) {
  if (typeof require !== "undefined") return require.apply(this, arguments);
  throw Error('Dynamic require of "' + x + '" is not supported');
});
var __esm = (fn, res) => function __init() {
  return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
};
var __commonJS = (cb, mod) => function __require2() {
  return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
};
var __export = (target, all) => {
  for (var name in all)
    __defProp(target, name, { get: all[name], enumerable: true });
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js
var util, objectUtil, ZodParsedType, getParsedType;
var init_util = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/util.js"() {
    (function(util2) {
      util2.assertEqual = (_) => {
      };
      function assertIs(_arg) {
      }
      util2.assertIs = assertIs;
      function assertNever(_x) {
        throw new Error();
      }
      util2.assertNever = assertNever;
      util2.arrayToEnum = (items) => {
        const obj = {};
        for (const item of items) {
          obj[item] = item;
        }
        return obj;
      };
      util2.getValidEnumValues = (obj) => {
        const validKeys = util2.objectKeys(obj).filter((k) => typeof obj[obj[k]] !== "number");
        const filtered = {};
        for (const k of validKeys) {
          filtered[k] = obj[k];
        }
        return util2.objectValues(filtered);
      };
      util2.objectValues = (obj) => {
        return util2.objectKeys(obj).map(function(e) {
          return obj[e];
        });
      };
      util2.objectKeys = typeof Object.keys === "function" ? (obj) => Object.keys(obj) : (object) => {
        const keys = [];
        for (const key in object) {
          if (Object.prototype.hasOwnProperty.call(object, key)) {
            keys.push(key);
          }
        }
        return keys;
      };
      util2.find = (arr, checker) => {
        for (const item of arr) {
          if (checker(item))
            return item;
        }
        return void 0;
      };
      util2.isInteger = typeof Number.isInteger === "function" ? (val) => Number.isInteger(val) : (val) => typeof val === "number" && Number.isFinite(val) && Math.floor(val) === val;
      function joinValues(array, separator = " | ") {
        return array.map((val) => typeof val === "string" ? `'${val}'` : val).join(separator);
      }
      util2.joinValues = joinValues;
      util2.jsonStringifyReplacer = (_, value) => {
        if (typeof value === "bigint") {
          return value.toString();
        }
        return value;
      };
    })(util || (util = {}));
    (function(objectUtil2) {
      objectUtil2.mergeShapes = (first, second) => {
        return {
          ...first,
          ...second
          // second overwrites first
        };
      };
    })(objectUtil || (objectUtil = {}));
    ZodParsedType = util.arrayToEnum([
      "string",
      "nan",
      "number",
      "integer",
      "float",
      "boolean",
      "date",
      "bigint",
      "symbol",
      "function",
      "undefined",
      "null",
      "array",
      "object",
      "unknown",
      "promise",
      "void",
      "never",
      "map",
      "set"
    ]);
    getParsedType = (data) => {
      const t = typeof data;
      switch (t) {
        case "undefined":
          return ZodParsedType.undefined;
        case "string":
          return ZodParsedType.string;
        case "number":
          return Number.isNaN(data) ? ZodParsedType.nan : ZodParsedType.number;
        case "boolean":
          return ZodParsedType.boolean;
        case "function":
          return ZodParsedType.function;
        case "bigint":
          return ZodParsedType.bigint;
        case "symbol":
          return ZodParsedType.symbol;
        case "object":
          if (Array.isArray(data)) {
            return ZodParsedType.array;
          }
          if (data === null) {
            return ZodParsedType.null;
          }
          if (data.then && typeof data.then === "function" && data.catch && typeof data.catch === "function") {
            return ZodParsedType.promise;
          }
          if (typeof Map !== "undefined" && data instanceof Map) {
            return ZodParsedType.map;
          }
          if (typeof Set !== "undefined" && data instanceof Set) {
            return ZodParsedType.set;
          }
          if (typeof Date !== "undefined" && data instanceof Date) {
            return ZodParsedType.date;
          }
          return ZodParsedType.object;
        default:
          return ZodParsedType.unknown;
      }
    };
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js
var ZodIssueCode, quotelessJson, ZodError;
var init_ZodError = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/ZodError.js"() {
    init_util();
    ZodIssueCode = util.arrayToEnum([
      "invalid_type",
      "invalid_literal",
      "custom",
      "invalid_union",
      "invalid_union_discriminator",
      "invalid_enum_value",
      "unrecognized_keys",
      "invalid_arguments",
      "invalid_return_type",
      "invalid_date",
      "invalid_string",
      "too_small",
      "too_big",
      "invalid_intersection_types",
      "not_multiple_of",
      "not_finite"
    ]);
    quotelessJson = (obj) => {
      const json = JSON.stringify(obj, null, 2);
      return json.replace(/"([^"]+)":/g, "$1:");
    };
    ZodError = class _ZodError extends Error {
      get errors() {
        return this.issues;
      }
      constructor(issues) {
        super();
        this.issues = [];
        this.addIssue = (sub) => {
          this.issues = [...this.issues, sub];
        };
        this.addIssues = (subs = []) => {
          this.issues = [...this.issues, ...subs];
        };
        const actualProto = new.target.prototype;
        if (Object.setPrototypeOf) {
          Object.setPrototypeOf(this, actualProto);
        } else {
          this.__proto__ = actualProto;
        }
        this.name = "ZodError";
        this.issues = issues;
      }
      format(_mapper) {
        const mapper = _mapper || function(issue) {
          return issue.message;
        };
        const fieldErrors = { _errors: [] };
        const processError = (error) => {
          for (const issue of error.issues) {
            if (issue.code === "invalid_union") {
              issue.unionErrors.map(processError);
            } else if (issue.code === "invalid_return_type") {
              processError(issue.returnTypeError);
            } else if (issue.code === "invalid_arguments") {
              processError(issue.argumentsError);
            } else if (issue.path.length === 0) {
              fieldErrors._errors.push(mapper(issue));
            } else {
              let curr = fieldErrors;
              let i = 0;
              while (i < issue.path.length) {
                const el = issue.path[i];
                const terminal = i === issue.path.length - 1;
                if (!terminal) {
                  curr[el] = curr[el] || { _errors: [] };
                } else {
                  curr[el] = curr[el] || { _errors: [] };
                  curr[el]._errors.push(mapper(issue));
                }
                curr = curr[el];
                i++;
              }
            }
          }
        };
        processError(this);
        return fieldErrors;
      }
      static assert(value) {
        if (!(value instanceof _ZodError)) {
          throw new Error(`Not a ZodError: ${value}`);
        }
      }
      toString() {
        return this.message;
      }
      get message() {
        return JSON.stringify(this.issues, util.jsonStringifyReplacer, 2);
      }
      get isEmpty() {
        return this.issues.length === 0;
      }
      flatten(mapper = (issue) => issue.message) {
        const fieldErrors = {};
        const formErrors = [];
        for (const sub of this.issues) {
          if (sub.path.length > 0) {
            const firstEl = sub.path[0];
            fieldErrors[firstEl] = fieldErrors[firstEl] || [];
            fieldErrors[firstEl].push(mapper(sub));
          } else {
            formErrors.push(mapper(sub));
          }
        }
        return { formErrors, fieldErrors };
      }
      get formErrors() {
        return this.flatten();
      }
    };
    ZodError.create = (issues) => {
      const error = new ZodError(issues);
      return error;
    };
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js
var errorMap, en_default;
var init_en = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/locales/en.js"() {
    init_ZodError();
    init_util();
    errorMap = (issue, _ctx) => {
      let message;
      switch (issue.code) {
        case ZodIssueCode.invalid_type:
          if (issue.received === ZodParsedType.undefined) {
            message = "Required";
          } else {
            message = `Expected ${issue.expected}, received ${issue.received}`;
          }
          break;
        case ZodIssueCode.invalid_literal:
          message = `Invalid literal value, expected ${JSON.stringify(issue.expected, util.jsonStringifyReplacer)}`;
          break;
        case ZodIssueCode.unrecognized_keys:
          message = `Unrecognized key(s) in object: ${util.joinValues(issue.keys, ", ")}`;
          break;
        case ZodIssueCode.invalid_union:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_union_discriminator:
          message = `Invalid discriminator value. Expected ${util.joinValues(issue.options)}`;
          break;
        case ZodIssueCode.invalid_enum_value:
          message = `Invalid enum value. Expected ${util.joinValues(issue.options)}, received '${issue.received}'`;
          break;
        case ZodIssueCode.invalid_arguments:
          message = `Invalid function arguments`;
          break;
        case ZodIssueCode.invalid_return_type:
          message = `Invalid function return type`;
          break;
        case ZodIssueCode.invalid_date:
          message = `Invalid date`;
          break;
        case ZodIssueCode.invalid_string:
          if (typeof issue.validation === "object") {
            if ("includes" in issue.validation) {
              message = `Invalid input: must include "${issue.validation.includes}"`;
              if (typeof issue.validation.position === "number") {
                message = `${message} at one or more positions greater than or equal to ${issue.validation.position}`;
              }
            } else if ("startsWith" in issue.validation) {
              message = `Invalid input: must start with "${issue.validation.startsWith}"`;
            } else if ("endsWith" in issue.validation) {
              message = `Invalid input: must end with "${issue.validation.endsWith}"`;
            } else {
              util.assertNever(issue.validation);
            }
          } else if (issue.validation !== "regex") {
            message = `Invalid ${issue.validation}`;
          } else {
            message = "Invalid";
          }
          break;
        case ZodIssueCode.too_small:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `more than`} ${issue.minimum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? "exactly" : issue.inclusive ? `at least` : `over`} ${issue.minimum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "bigint")
            message = `Number must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${issue.minimum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly equal to ` : issue.inclusive ? `greater than or equal to ` : `greater than `}${new Date(Number(issue.minimum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.too_big:
          if (issue.type === "array")
            message = `Array must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `less than`} ${issue.maximum} element(s)`;
          else if (issue.type === "string")
            message = `String must contain ${issue.exact ? `exactly` : issue.inclusive ? `at most` : `under`} ${issue.maximum} character(s)`;
          else if (issue.type === "number")
            message = `Number must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "bigint")
            message = `BigInt must be ${issue.exact ? `exactly` : issue.inclusive ? `less than or equal to` : `less than`} ${issue.maximum}`;
          else if (issue.type === "date")
            message = `Date must be ${issue.exact ? `exactly` : issue.inclusive ? `smaller than or equal to` : `smaller than`} ${new Date(Number(issue.maximum))}`;
          else
            message = "Invalid input";
          break;
        case ZodIssueCode.custom:
          message = `Invalid input`;
          break;
        case ZodIssueCode.invalid_intersection_types:
          message = `Intersection results could not be merged`;
          break;
        case ZodIssueCode.not_multiple_of:
          message = `Number must be a multiple of ${issue.multipleOf}`;
          break;
        case ZodIssueCode.not_finite:
          message = "Number must be finite";
          break;
        default:
          message = _ctx.defaultError;
          util.assertNever(issue);
      }
      return { message };
    };
    en_default = errorMap;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js
function setErrorMap(map) {
  overrideErrorMap = map;
}
function getErrorMap() {
  return overrideErrorMap;
}
var overrideErrorMap;
var init_errors = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/errors.js"() {
    init_en();
    overrideErrorMap = en_default;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js
function addIssueToContext(ctx, issueData) {
  const overrideMap = getErrorMap();
  const issue = makeIssue({
    issueData,
    data: ctx.data,
    path: ctx.path,
    errorMaps: [
      ctx.common.contextualErrorMap,
      // contextual error map is first priority
      ctx.schemaErrorMap,
      // then schema-bound map if available
      overrideMap,
      // then global override map
      overrideMap === en_default ? void 0 : en_default
      // then global default map
    ].filter((x) => !!x)
  });
  ctx.common.issues.push(issue);
}
var makeIssue, EMPTY_PATH, ParseStatus, INVALID, DIRTY, OK, isAborted, isDirty, isValid, isAsync;
var init_parseUtil = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/parseUtil.js"() {
    init_errors();
    init_en();
    makeIssue = (params) => {
      const { data, path: path27, errorMaps, issueData } = params;
      const fullPath = [...path27, ...issueData.path || []];
      const fullIssue = {
        ...issueData,
        path: fullPath
      };
      if (issueData.message !== void 0) {
        return {
          ...issueData,
          path: fullPath,
          message: issueData.message
        };
      }
      let errorMessage = "";
      const maps = errorMaps.filter((m) => !!m).slice().reverse();
      for (const map of maps) {
        errorMessage = map(fullIssue, { data, defaultError: errorMessage }).message;
      }
      return {
        ...issueData,
        path: fullPath,
        message: errorMessage
      };
    };
    EMPTY_PATH = [];
    ParseStatus = class _ParseStatus {
      constructor() {
        this.value = "valid";
      }
      dirty() {
        if (this.value === "valid")
          this.value = "dirty";
      }
      abort() {
        if (this.value !== "aborted")
          this.value = "aborted";
      }
      static mergeArray(status, results) {
        const arrayValue = [];
        for (const s of results) {
          if (s.status === "aborted")
            return INVALID;
          if (s.status === "dirty")
            status.dirty();
          arrayValue.push(s.value);
        }
        return { status: status.value, value: arrayValue };
      }
      static async mergeObjectAsync(status, pairs) {
        const syncPairs = [];
        for (const pair of pairs) {
          const key = await pair.key;
          const value = await pair.value;
          syncPairs.push({
            key,
            value
          });
        }
        return _ParseStatus.mergeObjectSync(status, syncPairs);
      }
      static mergeObjectSync(status, pairs) {
        const finalObject = {};
        for (const pair of pairs) {
          const { key, value } = pair;
          if (key.status === "aborted")
            return INVALID;
          if (value.status === "aborted")
            return INVALID;
          if (key.status === "dirty")
            status.dirty();
          if (value.status === "dirty")
            status.dirty();
          if (key.value !== "__proto__" && (typeof value.value !== "undefined" || pair.alwaysSet)) {
            finalObject[key.value] = value.value;
          }
        }
        return { status: status.value, value: finalObject };
      }
    };
    INVALID = Object.freeze({
      status: "aborted"
    });
    DIRTY = (value) => ({ status: "dirty", value });
    OK = (value) => ({ status: "valid", value });
    isAborted = (x) => x.status === "aborted";
    isDirty = (x) => x.status === "dirty";
    isValid = (x) => x.status === "valid";
    isAsync = (x) => typeof Promise !== "undefined" && x instanceof Promise;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/typeAliases.js
var init_typeAliases = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/typeAliases.js"() {
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js
var errorUtil;
var init_errorUtil = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/helpers/errorUtil.js"() {
    (function(errorUtil2) {
      errorUtil2.errToObj = (message) => typeof message === "string" ? { message } : message || {};
      errorUtil2.toString = (message) => typeof message === "string" ? message : message?.message;
    })(errorUtil || (errorUtil = {}));
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js
function processCreateParams(params) {
  if (!params)
    return {};
  const { errorMap: errorMap2, invalid_type_error, required_error, description } = params;
  if (errorMap2 && (invalid_type_error || required_error)) {
    throw new Error(`Can't use "invalid_type_error" or "required_error" in conjunction with custom error map.`);
  }
  if (errorMap2)
    return { errorMap: errorMap2, description };
  const customMap = (iss, ctx) => {
    const { message } = params;
    if (iss.code === "invalid_enum_value") {
      return { message: message ?? ctx.defaultError };
    }
    if (typeof ctx.data === "undefined") {
      return { message: message ?? required_error ?? ctx.defaultError };
    }
    if (iss.code !== "invalid_type")
      return { message: ctx.defaultError };
    return { message: message ?? invalid_type_error ?? ctx.defaultError };
  };
  return { errorMap: customMap, description };
}
function timeRegexSource(args) {
  let secondsRegexSource = `[0-5]\\d`;
  if (args.precision) {
    secondsRegexSource = `${secondsRegexSource}\\.\\d{${args.precision}}`;
  } else if (args.precision == null) {
    secondsRegexSource = `${secondsRegexSource}(\\.\\d+)?`;
  }
  const secondsQuantifier = args.precision ? "+" : "?";
  return `([01]\\d|2[0-3]):[0-5]\\d(:${secondsRegexSource})${secondsQuantifier}`;
}
function timeRegex(args) {
  return new RegExp(`^${timeRegexSource(args)}$`);
}
function datetimeRegex(args) {
  let regex = `${dateRegexSource}T${timeRegexSource(args)}`;
  const opts = [];
  opts.push(args.local ? `Z?` : `Z`);
  if (args.offset)
    opts.push(`([+-]\\d{2}:?\\d{2})`);
  regex = `${regex}(${opts.join("|")})`;
  return new RegExp(`^${regex}$`);
}
function isValidIP(ip, version) {
  if ((version === "v4" || !version) && ipv4Regex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6Regex.test(ip)) {
    return true;
  }
  return false;
}
function isValidJWT(jwt, alg) {
  if (!jwtRegex.test(jwt))
    return false;
  try {
    const [header] = jwt.split(".");
    if (!header)
      return false;
    const base64 = header.replace(/-/g, "+").replace(/_/g, "/").padEnd(header.length + (4 - header.length % 4) % 4, "=");
    const decoded = JSON.parse(atob(base64));
    if (typeof decoded !== "object" || decoded === null)
      return false;
    if ("typ" in decoded && decoded?.typ !== "JWT")
      return false;
    if (!decoded.alg)
      return false;
    if (alg && decoded.alg !== alg)
      return false;
    return true;
  } catch {
    return false;
  }
}
function isValidCidr(ip, version) {
  if ((version === "v4" || !version) && ipv4CidrRegex.test(ip)) {
    return true;
  }
  if ((version === "v6" || !version) && ipv6CidrRegex.test(ip)) {
    return true;
  }
  return false;
}
function floatSafeRemainder(val, step) {
  const valDecCount = (val.toString().split(".")[1] || "").length;
  const stepDecCount = (step.toString().split(".")[1] || "").length;
  const decCount = valDecCount > stepDecCount ? valDecCount : stepDecCount;
  const valInt = Number.parseInt(val.toFixed(decCount).replace(".", ""));
  const stepInt = Number.parseInt(step.toFixed(decCount).replace(".", ""));
  return valInt % stepInt / 10 ** decCount;
}
function deepPartialify(schema) {
  if (schema instanceof ZodObject) {
    const newShape = {};
    for (const key in schema.shape) {
      const fieldSchema = schema.shape[key];
      newShape[key] = ZodOptional.create(deepPartialify(fieldSchema));
    }
    return new ZodObject({
      ...schema._def,
      shape: () => newShape
    });
  } else if (schema instanceof ZodArray) {
    return new ZodArray({
      ...schema._def,
      type: deepPartialify(schema.element)
    });
  } else if (schema instanceof ZodOptional) {
    return ZodOptional.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodNullable) {
    return ZodNullable.create(deepPartialify(schema.unwrap()));
  } else if (schema instanceof ZodTuple) {
    return ZodTuple.create(schema.items.map((item) => deepPartialify(item)));
  } else {
    return schema;
  }
}
function mergeValues(a, b) {
  const aType = getParsedType(a);
  const bType = getParsedType(b);
  if (a === b) {
    return { valid: true, data: a };
  } else if (aType === ZodParsedType.object && bType === ZodParsedType.object) {
    const bKeys = util.objectKeys(b);
    const sharedKeys = util.objectKeys(a).filter((key) => bKeys.indexOf(key) !== -1);
    const newObj = { ...a, ...b };
    for (const key of sharedKeys) {
      const sharedValue = mergeValues(a[key], b[key]);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newObj[key] = sharedValue.data;
    }
    return { valid: true, data: newObj };
  } else if (aType === ZodParsedType.array && bType === ZodParsedType.array) {
    if (a.length !== b.length) {
      return { valid: false };
    }
    const newArray = [];
    for (let index = 0; index < a.length; index++) {
      const itemA = a[index];
      const itemB = b[index];
      const sharedValue = mergeValues(itemA, itemB);
      if (!sharedValue.valid) {
        return { valid: false };
      }
      newArray.push(sharedValue.data);
    }
    return { valid: true, data: newArray };
  } else if (aType === ZodParsedType.date && bType === ZodParsedType.date && +a === +b) {
    return { valid: true, data: a };
  } else {
    return { valid: false };
  }
}
function createZodEnum(values, params) {
  return new ZodEnum({
    values,
    typeName: ZodFirstPartyTypeKind.ZodEnum,
    ...processCreateParams(params)
  });
}
function cleanParams(params, data) {
  const p = typeof params === "function" ? params(data) : typeof params === "string" ? { message: params } : params;
  const p2 = typeof p === "string" ? { message: p } : p;
  return p2;
}
function custom(check, _params = {}, fatal) {
  if (check)
    return ZodAny.create().superRefine((data, ctx) => {
      const r = check(data);
      if (r instanceof Promise) {
        return r.then((r2) => {
          if (!r2) {
            const params = cleanParams(_params, data);
            const _fatal = params.fatal ?? fatal ?? true;
            ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
          }
        });
      }
      if (!r) {
        const params = cleanParams(_params, data);
        const _fatal = params.fatal ?? fatal ?? true;
        ctx.addIssue({ code: "custom", ...params, fatal: _fatal });
      }
      return;
    });
  return ZodAny.create();
}
var ParseInputLazyPath, handleResult, ZodType, cuidRegex, cuid2Regex, ulidRegex, uuidRegex, nanoidRegex, jwtRegex, durationRegex, emailRegex, _emojiRegex, emojiRegex, ipv4Regex, ipv4CidrRegex, ipv6Regex, ipv6CidrRegex, base64Regex, base64urlRegex, dateRegexSource, dateRegex, ZodString, ZodNumber, ZodBigInt, ZodBoolean, ZodDate, ZodSymbol, ZodUndefined, ZodNull, ZodAny, ZodUnknown, ZodNever, ZodVoid, ZodArray, ZodObject, ZodUnion, getDiscriminator, ZodDiscriminatedUnion, ZodIntersection, ZodTuple, ZodRecord, ZodMap, ZodSet, ZodFunction, ZodLazy, ZodLiteral, ZodEnum, ZodNativeEnum, ZodPromise, ZodEffects, ZodOptional, ZodNullable, ZodDefault, ZodCatch, ZodNaN, BRAND, ZodBranded, ZodPipeline, ZodReadonly, late, ZodFirstPartyTypeKind, instanceOfType, stringType, numberType, nanType, bigIntType, booleanType, dateType, symbolType, undefinedType, nullType, anyType, unknownType, neverType, voidType, arrayType, objectType, strictObjectType, unionType, discriminatedUnionType, intersectionType, tupleType, recordType, mapType, setType, functionType, lazyType, literalType, enumType, nativeEnumType, promiseType, effectsType, optionalType, nullableType, preprocessType, pipelineType, ostring, onumber, oboolean, coerce, NEVER;
var init_types = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/types.js"() {
    init_ZodError();
    init_errors();
    init_errorUtil();
    init_parseUtil();
    init_util();
    ParseInputLazyPath = class {
      constructor(parent, value, path27, key) {
        this._cachedPath = [];
        this.parent = parent;
        this.data = value;
        this._path = path27;
        this._key = key;
      }
      get path() {
        if (!this._cachedPath.length) {
          if (Array.isArray(this._key)) {
            this._cachedPath.push(...this._path, ...this._key);
          } else {
            this._cachedPath.push(...this._path, this._key);
          }
        }
        return this._cachedPath;
      }
    };
    handleResult = (ctx, result) => {
      if (isValid(result)) {
        return { success: true, data: result.value };
      } else {
        if (!ctx.common.issues.length) {
          throw new Error("Validation failed but no issues detected.");
        }
        return {
          success: false,
          get error() {
            if (this._error)
              return this._error;
            const error = new ZodError(ctx.common.issues);
            this._error = error;
            return this._error;
          }
        };
      }
    };
    ZodType = class {
      get description() {
        return this._def.description;
      }
      _getType(input) {
        return getParsedType(input.data);
      }
      _getOrReturnCtx(input, ctx) {
        return ctx || {
          common: input.parent.common,
          data: input.data,
          parsedType: getParsedType(input.data),
          schemaErrorMap: this._def.errorMap,
          path: input.path,
          parent: input.parent
        };
      }
      _processInputParams(input) {
        return {
          status: new ParseStatus(),
          ctx: {
            common: input.parent.common,
            data: input.data,
            parsedType: getParsedType(input.data),
            schemaErrorMap: this._def.errorMap,
            path: input.path,
            parent: input.parent
          }
        };
      }
      _parseSync(input) {
        const result = this._parse(input);
        if (isAsync(result)) {
          throw new Error("Synchronous parse encountered promise.");
        }
        return result;
      }
      _parseAsync(input) {
        const result = this._parse(input);
        return Promise.resolve(result);
      }
      parse(data, params) {
        const result = this.safeParse(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      safeParse(data, params) {
        const ctx = {
          common: {
            issues: [],
            async: params?.async ?? false,
            contextualErrorMap: params?.errorMap
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const result = this._parseSync({ data, path: ctx.path, parent: ctx });
        return handleResult(ctx, result);
      }
      "~validate"(data) {
        const ctx = {
          common: {
            issues: [],
            async: !!this["~standard"].async
          },
          path: [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        if (!this["~standard"].async) {
          try {
            const result = this._parseSync({ data, path: [], parent: ctx });
            return isValid(result) ? {
              value: result.value
            } : {
              issues: ctx.common.issues
            };
          } catch (err) {
            if (err?.message?.toLowerCase()?.includes("encountered")) {
              this["~standard"].async = true;
            }
            ctx.common = {
              issues: [],
              async: true
            };
          }
        }
        return this._parseAsync({ data, path: [], parent: ctx }).then((result) => isValid(result) ? {
          value: result.value
        } : {
          issues: ctx.common.issues
        });
      }
      async parseAsync(data, params) {
        const result = await this.safeParseAsync(data, params);
        if (result.success)
          return result.data;
        throw result.error;
      }
      async safeParseAsync(data, params) {
        const ctx = {
          common: {
            issues: [],
            contextualErrorMap: params?.errorMap,
            async: true
          },
          path: params?.path || [],
          schemaErrorMap: this._def.errorMap,
          parent: null,
          data,
          parsedType: getParsedType(data)
        };
        const maybeAsyncResult = this._parse({ data, path: ctx.path, parent: ctx });
        const result = await (isAsync(maybeAsyncResult) ? maybeAsyncResult : Promise.resolve(maybeAsyncResult));
        return handleResult(ctx, result);
      }
      refine(check, message) {
        const getIssueProperties = (val) => {
          if (typeof message === "string" || typeof message === "undefined") {
            return { message };
          } else if (typeof message === "function") {
            return message(val);
          } else {
            return message;
          }
        };
        return this._refinement((val, ctx) => {
          const result = check(val);
          const setError = () => ctx.addIssue({
            code: ZodIssueCode.custom,
            ...getIssueProperties(val)
          });
          if (typeof Promise !== "undefined" && result instanceof Promise) {
            return result.then((data) => {
              if (!data) {
                setError();
                return false;
              } else {
                return true;
              }
            });
          }
          if (!result) {
            setError();
            return false;
          } else {
            return true;
          }
        });
      }
      refinement(check, refinementData) {
        return this._refinement((val, ctx) => {
          if (!check(val)) {
            ctx.addIssue(typeof refinementData === "function" ? refinementData(val, ctx) : refinementData);
            return false;
          } else {
            return true;
          }
        });
      }
      _refinement(refinement) {
        return new ZodEffects({
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "refinement", refinement }
        });
      }
      superRefine(refinement) {
        return this._refinement(refinement);
      }
      constructor(def) {
        this.spa = this.safeParseAsync;
        this._def = def;
        this.parse = this.parse.bind(this);
        this.safeParse = this.safeParse.bind(this);
        this.parseAsync = this.parseAsync.bind(this);
        this.safeParseAsync = this.safeParseAsync.bind(this);
        this.spa = this.spa.bind(this);
        this.refine = this.refine.bind(this);
        this.refinement = this.refinement.bind(this);
        this.superRefine = this.superRefine.bind(this);
        this.optional = this.optional.bind(this);
        this.nullable = this.nullable.bind(this);
        this.nullish = this.nullish.bind(this);
        this.array = this.array.bind(this);
        this.promise = this.promise.bind(this);
        this.or = this.or.bind(this);
        this.and = this.and.bind(this);
        this.transform = this.transform.bind(this);
        this.brand = this.brand.bind(this);
        this.default = this.default.bind(this);
        this.catch = this.catch.bind(this);
        this.describe = this.describe.bind(this);
        this.pipe = this.pipe.bind(this);
        this.readonly = this.readonly.bind(this);
        this.isNullable = this.isNullable.bind(this);
        this.isOptional = this.isOptional.bind(this);
        this["~standard"] = {
          version: 1,
          vendor: "zod",
          validate: (data) => this["~validate"](data)
        };
      }
      optional() {
        return ZodOptional.create(this, this._def);
      }
      nullable() {
        return ZodNullable.create(this, this._def);
      }
      nullish() {
        return this.nullable().optional();
      }
      array() {
        return ZodArray.create(this);
      }
      promise() {
        return ZodPromise.create(this, this._def);
      }
      or(option) {
        return ZodUnion.create([this, option], this._def);
      }
      and(incoming) {
        return ZodIntersection.create(this, incoming, this._def);
      }
      transform(transform) {
        return new ZodEffects({
          ...processCreateParams(this._def),
          schema: this,
          typeName: ZodFirstPartyTypeKind.ZodEffects,
          effect: { type: "transform", transform }
        });
      }
      default(def) {
        const defaultValueFunc = typeof def === "function" ? def : () => def;
        return new ZodDefault({
          ...processCreateParams(this._def),
          innerType: this,
          defaultValue: defaultValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodDefault
        });
      }
      brand() {
        return new ZodBranded({
          typeName: ZodFirstPartyTypeKind.ZodBranded,
          type: this,
          ...processCreateParams(this._def)
        });
      }
      catch(def) {
        const catchValueFunc = typeof def === "function" ? def : () => def;
        return new ZodCatch({
          ...processCreateParams(this._def),
          innerType: this,
          catchValue: catchValueFunc,
          typeName: ZodFirstPartyTypeKind.ZodCatch
        });
      }
      describe(description) {
        const This = this.constructor;
        return new This({
          ...this._def,
          description
        });
      }
      pipe(target) {
        return ZodPipeline.create(this, target);
      }
      readonly() {
        return ZodReadonly.create(this);
      }
      isOptional() {
        return this.safeParse(void 0).success;
      }
      isNullable() {
        return this.safeParse(null).success;
      }
    };
    cuidRegex = /^c[^\s-]{8,}$/i;
    cuid2Regex = /^[0-9a-z]+$/;
    ulidRegex = /^[0-9A-HJKMNP-TV-Z]{26}$/i;
    uuidRegex = /^[0-9a-fA-F]{8}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{4}\b-[0-9a-fA-F]{12}$/i;
    nanoidRegex = /^[a-z0-9_-]{21}$/i;
    jwtRegex = /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/;
    durationRegex = /^[-+]?P(?!$)(?:(?:[-+]?\d+Y)|(?:[-+]?\d+[.,]\d+Y$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:(?:[-+]?\d+W)|(?:[-+]?\d+[.,]\d+W$))?(?:(?:[-+]?\d+D)|(?:[-+]?\d+[.,]\d+D$))?(?:T(?=[\d+-])(?:(?:[-+]?\d+H)|(?:[-+]?\d+[.,]\d+H$))?(?:(?:[-+]?\d+M)|(?:[-+]?\d+[.,]\d+M$))?(?:[-+]?\d+(?:[.,]\d+)?S)?)??$/;
    emailRegex = /^(?!\.)(?!.*\.\.)([A-Z0-9_'+\-\.]*)[A-Z0-9_+-]@([A-Z0-9][A-Z0-9\-]*\.)+[A-Z]{2,}$/i;
    _emojiRegex = `^(\\p{Extended_Pictographic}|\\p{Emoji_Component})+$`;
    ipv4Regex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])$/;
    ipv4CidrRegex = /^(?:(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\.){3}(?:25[0-5]|2[0-4][0-9]|1[0-9][0-9]|[1-9][0-9]|[0-9])\/(3[0-2]|[12]?[0-9])$/;
    ipv6Regex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))$/;
    ipv6CidrRegex = /^(([0-9a-fA-F]{1,4}:){7,7}[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,7}:|([0-9a-fA-F]{1,4}:){1,6}:[0-9a-fA-F]{1,4}|([0-9a-fA-F]{1,4}:){1,5}(:[0-9a-fA-F]{1,4}){1,2}|([0-9a-fA-F]{1,4}:){1,4}(:[0-9a-fA-F]{1,4}){1,3}|([0-9a-fA-F]{1,4}:){1,3}(:[0-9a-fA-F]{1,4}){1,4}|([0-9a-fA-F]{1,4}:){1,2}(:[0-9a-fA-F]{1,4}){1,5}|[0-9a-fA-F]{1,4}:((:[0-9a-fA-F]{1,4}){1,6})|:((:[0-9a-fA-F]{1,4}){1,7}|:)|fe80:(:[0-9a-fA-F]{0,4}){0,4}%[0-9a-zA-Z]{1,}|::(ffff(:0{1,4}){0,1}:){0,1}((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])|([0-9a-fA-F]{1,4}:){1,4}:((25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9])\.){3,3}(25[0-5]|(2[0-4]|1{0,1}[0-9]){0,1}[0-9]))\/(12[0-8]|1[01][0-9]|[1-9]?[0-9])$/;
    base64Regex = /^([0-9a-zA-Z+/]{4})*(([0-9a-zA-Z+/]{2}==)|([0-9a-zA-Z+/]{3}=))?$/;
    base64urlRegex = /^([0-9a-zA-Z-_]{4})*(([0-9a-zA-Z-_]{2}(==)?)|([0-9a-zA-Z-_]{3}(=)?))?$/;
    dateRegexSource = `((\\d\\d[2468][048]|\\d\\d[13579][26]|\\d\\d0[48]|[02468][048]00|[13579][26]00)-02-29|\\d{4}-((0[13578]|1[02])-(0[1-9]|[12]\\d|3[01])|(0[469]|11)-(0[1-9]|[12]\\d|30)|(02)-(0[1-9]|1\\d|2[0-8])))`;
    dateRegex = new RegExp(`^${dateRegexSource}$`);
    ZodString = class _ZodString extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = String(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.string) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.string,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.length < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.length > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "string",
                inclusive: true,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "length") {
            const tooBig = input.data.length > check.value;
            const tooSmall = input.data.length < check.value;
            if (tooBig || tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              if (tooBig) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_big,
                  maximum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              } else if (tooSmall) {
                addIssueToContext(ctx, {
                  code: ZodIssueCode.too_small,
                  minimum: check.value,
                  type: "string",
                  inclusive: true,
                  exact: true,
                  message: check.message
                });
              }
              status.dirty();
            }
          } else if (check.kind === "email") {
            if (!emailRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "email",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "emoji") {
            if (!emojiRegex) {
              emojiRegex = new RegExp(_emojiRegex, "u");
            }
            if (!emojiRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "emoji",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "uuid") {
            if (!uuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "uuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "nanoid") {
            if (!nanoidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "nanoid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid") {
            if (!cuidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cuid2") {
            if (!cuid2Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cuid2",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ulid") {
            if (!ulidRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ulid",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "url") {
            try {
              new URL(input.data);
            } catch {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "regex") {
            check.regex.lastIndex = 0;
            const testResult = check.regex.test(input.data);
            if (!testResult) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "regex",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "trim") {
            input.data = input.data.trim();
          } else if (check.kind === "includes") {
            if (!input.data.includes(check.value, check.position)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { includes: check.value, position: check.position },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "toLowerCase") {
            input.data = input.data.toLowerCase();
          } else if (check.kind === "toUpperCase") {
            input.data = input.data.toUpperCase();
          } else if (check.kind === "startsWith") {
            if (!input.data.startsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { startsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "endsWith") {
            if (!input.data.endsWith(check.value)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: { endsWith: check.value },
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "datetime") {
            const regex = datetimeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "datetime",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "date") {
            const regex = dateRegex;
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "date",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "time") {
            const regex = timeRegex(check);
            if (!regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_string,
                validation: "time",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "duration") {
            if (!durationRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "duration",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "ip") {
            if (!isValidIP(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "ip",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "jwt") {
            if (!isValidJWT(input.data, check.alg)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "jwt",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "cidr") {
            if (!isValidCidr(input.data, check.version)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "cidr",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64") {
            if (!base64Regex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "base64url") {
            if (!base64urlRegex.test(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                validation: "base64url",
                code: ZodIssueCode.invalid_string,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _regex(regex, validation, message) {
        return this.refinement((data) => regex.test(data), {
          validation,
          code: ZodIssueCode.invalid_string,
          ...errorUtil.errToObj(message)
        });
      }
      _addCheck(check) {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      email(message) {
        return this._addCheck({ kind: "email", ...errorUtil.errToObj(message) });
      }
      url(message) {
        return this._addCheck({ kind: "url", ...errorUtil.errToObj(message) });
      }
      emoji(message) {
        return this._addCheck({ kind: "emoji", ...errorUtil.errToObj(message) });
      }
      uuid(message) {
        return this._addCheck({ kind: "uuid", ...errorUtil.errToObj(message) });
      }
      nanoid(message) {
        return this._addCheck({ kind: "nanoid", ...errorUtil.errToObj(message) });
      }
      cuid(message) {
        return this._addCheck({ kind: "cuid", ...errorUtil.errToObj(message) });
      }
      cuid2(message) {
        return this._addCheck({ kind: "cuid2", ...errorUtil.errToObj(message) });
      }
      ulid(message) {
        return this._addCheck({ kind: "ulid", ...errorUtil.errToObj(message) });
      }
      base64(message) {
        return this._addCheck({ kind: "base64", ...errorUtil.errToObj(message) });
      }
      base64url(message) {
        return this._addCheck({
          kind: "base64url",
          ...errorUtil.errToObj(message)
        });
      }
      jwt(options) {
        return this._addCheck({ kind: "jwt", ...errorUtil.errToObj(options) });
      }
      ip(options) {
        return this._addCheck({ kind: "ip", ...errorUtil.errToObj(options) });
      }
      cidr(options) {
        return this._addCheck({ kind: "cidr", ...errorUtil.errToObj(options) });
      }
      datetime(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "datetime",
            precision: null,
            offset: false,
            local: false,
            message: options
          });
        }
        return this._addCheck({
          kind: "datetime",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          offset: options?.offset ?? false,
          local: options?.local ?? false,
          ...errorUtil.errToObj(options?.message)
        });
      }
      date(message) {
        return this._addCheck({ kind: "date", message });
      }
      time(options) {
        if (typeof options === "string") {
          return this._addCheck({
            kind: "time",
            precision: null,
            message: options
          });
        }
        return this._addCheck({
          kind: "time",
          precision: typeof options?.precision === "undefined" ? null : options?.precision,
          ...errorUtil.errToObj(options?.message)
        });
      }
      duration(message) {
        return this._addCheck({ kind: "duration", ...errorUtil.errToObj(message) });
      }
      regex(regex, message) {
        return this._addCheck({
          kind: "regex",
          regex,
          ...errorUtil.errToObj(message)
        });
      }
      includes(value, options) {
        return this._addCheck({
          kind: "includes",
          value,
          position: options?.position,
          ...errorUtil.errToObj(options?.message)
        });
      }
      startsWith(value, message) {
        return this._addCheck({
          kind: "startsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      endsWith(value, message) {
        return this._addCheck({
          kind: "endsWith",
          value,
          ...errorUtil.errToObj(message)
        });
      }
      min(minLength, message) {
        return this._addCheck({
          kind: "min",
          value: minLength,
          ...errorUtil.errToObj(message)
        });
      }
      max(maxLength, message) {
        return this._addCheck({
          kind: "max",
          value: maxLength,
          ...errorUtil.errToObj(message)
        });
      }
      length(len, message) {
        return this._addCheck({
          kind: "length",
          value: len,
          ...errorUtil.errToObj(message)
        });
      }
      /**
       * Equivalent to `.min(1)`
       */
      nonempty(message) {
        return this.min(1, errorUtil.errToObj(message));
      }
      trim() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "trim" }]
        });
      }
      toLowerCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toLowerCase" }]
        });
      }
      toUpperCase() {
        return new _ZodString({
          ...this._def,
          checks: [...this._def.checks, { kind: "toUpperCase" }]
        });
      }
      get isDatetime() {
        return !!this._def.checks.find((ch) => ch.kind === "datetime");
      }
      get isDate() {
        return !!this._def.checks.find((ch) => ch.kind === "date");
      }
      get isTime() {
        return !!this._def.checks.find((ch) => ch.kind === "time");
      }
      get isDuration() {
        return !!this._def.checks.find((ch) => ch.kind === "duration");
      }
      get isEmail() {
        return !!this._def.checks.find((ch) => ch.kind === "email");
      }
      get isURL() {
        return !!this._def.checks.find((ch) => ch.kind === "url");
      }
      get isEmoji() {
        return !!this._def.checks.find((ch) => ch.kind === "emoji");
      }
      get isUUID() {
        return !!this._def.checks.find((ch) => ch.kind === "uuid");
      }
      get isNANOID() {
        return !!this._def.checks.find((ch) => ch.kind === "nanoid");
      }
      get isCUID() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid");
      }
      get isCUID2() {
        return !!this._def.checks.find((ch) => ch.kind === "cuid2");
      }
      get isULID() {
        return !!this._def.checks.find((ch) => ch.kind === "ulid");
      }
      get isIP() {
        return !!this._def.checks.find((ch) => ch.kind === "ip");
      }
      get isCIDR() {
        return !!this._def.checks.find((ch) => ch.kind === "cidr");
      }
      get isBase64() {
        return !!this._def.checks.find((ch) => ch.kind === "base64");
      }
      get isBase64url() {
        return !!this._def.checks.find((ch) => ch.kind === "base64url");
      }
      get minLength() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxLength() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodString.create = (params) => {
      return new ZodString({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodString,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodNumber = class _ZodNumber extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
        this.step = this.multipleOf;
      }
      _parse(input) {
        if (this._def.coerce) {
          input.data = Number(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.number) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.number,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "int") {
            if (!util.isInteger(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.invalid_type,
                expected: "integer",
                received: "float",
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                minimum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                maximum: check.value,
                type: "number",
                inclusive: check.inclusive,
                exact: false,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (floatSafeRemainder(input.data, check.value) !== 0) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "finite") {
            if (!Number.isFinite(input.data)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_finite,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodNumber({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodNumber({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      int(message) {
        return this._addCheck({
          kind: "int",
          message: errorUtil.toString(message)
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: 0,
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      finite(message) {
        return this._addCheck({
          kind: "finite",
          message: errorUtil.toString(message)
        });
      }
      safe(message) {
        return this._addCheck({
          kind: "min",
          inclusive: true,
          value: Number.MIN_SAFE_INTEGER,
          message: errorUtil.toString(message)
        })._addCheck({
          kind: "max",
          inclusive: true,
          value: Number.MAX_SAFE_INTEGER,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
      get isInt() {
        return !!this._def.checks.find((ch) => ch.kind === "int" || ch.kind === "multipleOf" && util.isInteger(ch.value));
      }
      get isFinite() {
        let max = null;
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "finite" || ch.kind === "int" || ch.kind === "multipleOf") {
            return true;
          } else if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          } else if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return Number.isFinite(min) && Number.isFinite(max);
      }
    };
    ZodNumber.create = (params) => {
      return new ZodNumber({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodNumber,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodBigInt = class _ZodBigInt extends ZodType {
      constructor() {
        super(...arguments);
        this.min = this.gte;
        this.max = this.lte;
      }
      _parse(input) {
        if (this._def.coerce) {
          try {
            input.data = BigInt(input.data);
          } catch {
            return this._getInvalidInput(input);
          }
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.bigint) {
          return this._getInvalidInput(input);
        }
        let ctx = void 0;
        const status = new ParseStatus();
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            const tooSmall = check.inclusive ? input.data < check.value : input.data <= check.value;
            if (tooSmall) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                type: "bigint",
                minimum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            const tooBig = check.inclusive ? input.data > check.value : input.data >= check.value;
            if (tooBig) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                type: "bigint",
                maximum: check.value,
                inclusive: check.inclusive,
                message: check.message
              });
              status.dirty();
            }
          } else if (check.kind === "multipleOf") {
            if (input.data % check.value !== BigInt(0)) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.not_multiple_of,
                multipleOf: check.value,
                message: check.message
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return { status: status.value, value: input.data };
      }
      _getInvalidInput(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.bigint,
          received: ctx.parsedType
        });
        return INVALID;
      }
      gte(value, message) {
        return this.setLimit("min", value, true, errorUtil.toString(message));
      }
      gt(value, message) {
        return this.setLimit("min", value, false, errorUtil.toString(message));
      }
      lte(value, message) {
        return this.setLimit("max", value, true, errorUtil.toString(message));
      }
      lt(value, message) {
        return this.setLimit("max", value, false, errorUtil.toString(message));
      }
      setLimit(kind, value, inclusive, message) {
        return new _ZodBigInt({
          ...this._def,
          checks: [
            ...this._def.checks,
            {
              kind,
              value,
              inclusive,
              message: errorUtil.toString(message)
            }
          ]
        });
      }
      _addCheck(check) {
        return new _ZodBigInt({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      positive(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      negative(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: false,
          message: errorUtil.toString(message)
        });
      }
      nonpositive(message) {
        return this._addCheck({
          kind: "max",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      nonnegative(message) {
        return this._addCheck({
          kind: "min",
          value: BigInt(0),
          inclusive: true,
          message: errorUtil.toString(message)
        });
      }
      multipleOf(value, message) {
        return this._addCheck({
          kind: "multipleOf",
          value,
          message: errorUtil.toString(message)
        });
      }
      get minValue() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min;
      }
      get maxValue() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max;
      }
    };
    ZodBigInt.create = (params) => {
      return new ZodBigInt({
        checks: [],
        typeName: ZodFirstPartyTypeKind.ZodBigInt,
        coerce: params?.coerce ?? false,
        ...processCreateParams(params)
      });
    };
    ZodBoolean = class extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = Boolean(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.boolean) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.boolean,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodBoolean.create = (params) => {
      return new ZodBoolean({
        typeName: ZodFirstPartyTypeKind.ZodBoolean,
        coerce: params?.coerce || false,
        ...processCreateParams(params)
      });
    };
    ZodDate = class _ZodDate extends ZodType {
      _parse(input) {
        if (this._def.coerce) {
          input.data = new Date(input.data);
        }
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.date) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.date,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        if (Number.isNaN(input.data.getTime())) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_date
          });
          return INVALID;
        }
        const status = new ParseStatus();
        let ctx = void 0;
        for (const check of this._def.checks) {
          if (check.kind === "min") {
            if (input.data.getTime() < check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_small,
                message: check.message,
                inclusive: true,
                exact: false,
                minimum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else if (check.kind === "max") {
            if (input.data.getTime() > check.value) {
              ctx = this._getOrReturnCtx(input, ctx);
              addIssueToContext(ctx, {
                code: ZodIssueCode.too_big,
                message: check.message,
                inclusive: true,
                exact: false,
                maximum: check.value,
                type: "date"
              });
              status.dirty();
            }
          } else {
            util.assertNever(check);
          }
        }
        return {
          status: status.value,
          value: new Date(input.data.getTime())
        };
      }
      _addCheck(check) {
        return new _ZodDate({
          ...this._def,
          checks: [...this._def.checks, check]
        });
      }
      min(minDate, message) {
        return this._addCheck({
          kind: "min",
          value: minDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      max(maxDate, message) {
        return this._addCheck({
          kind: "max",
          value: maxDate.getTime(),
          message: errorUtil.toString(message)
        });
      }
      get minDate() {
        let min = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "min") {
            if (min === null || ch.value > min)
              min = ch.value;
          }
        }
        return min != null ? new Date(min) : null;
      }
      get maxDate() {
        let max = null;
        for (const ch of this._def.checks) {
          if (ch.kind === "max") {
            if (max === null || ch.value < max)
              max = ch.value;
          }
        }
        return max != null ? new Date(max) : null;
      }
    };
    ZodDate.create = (params) => {
      return new ZodDate({
        checks: [],
        coerce: params?.coerce || false,
        typeName: ZodFirstPartyTypeKind.ZodDate,
        ...processCreateParams(params)
      });
    };
    ZodSymbol = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.symbol) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.symbol,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodSymbol.create = (params) => {
      return new ZodSymbol({
        typeName: ZodFirstPartyTypeKind.ZodSymbol,
        ...processCreateParams(params)
      });
    };
    ZodUndefined = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.undefined,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodUndefined.create = (params) => {
      return new ZodUndefined({
        typeName: ZodFirstPartyTypeKind.ZodUndefined,
        ...processCreateParams(params)
      });
    };
    ZodNull = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.null) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.null,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodNull.create = (params) => {
      return new ZodNull({
        typeName: ZodFirstPartyTypeKind.ZodNull,
        ...processCreateParams(params)
      });
    };
    ZodAny = class extends ZodType {
      constructor() {
        super(...arguments);
        this._any = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodAny.create = (params) => {
      return new ZodAny({
        typeName: ZodFirstPartyTypeKind.ZodAny,
        ...processCreateParams(params)
      });
    };
    ZodUnknown = class extends ZodType {
      constructor() {
        super(...arguments);
        this._unknown = true;
      }
      _parse(input) {
        return OK(input.data);
      }
    };
    ZodUnknown.create = (params) => {
      return new ZodUnknown({
        typeName: ZodFirstPartyTypeKind.ZodUnknown,
        ...processCreateParams(params)
      });
    };
    ZodNever = class extends ZodType {
      _parse(input) {
        const ctx = this._getOrReturnCtx(input);
        addIssueToContext(ctx, {
          code: ZodIssueCode.invalid_type,
          expected: ZodParsedType.never,
          received: ctx.parsedType
        });
        return INVALID;
      }
    };
    ZodNever.create = (params) => {
      return new ZodNever({
        typeName: ZodFirstPartyTypeKind.ZodNever,
        ...processCreateParams(params)
      });
    };
    ZodVoid = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.undefined) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.void,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return OK(input.data);
      }
    };
    ZodVoid.create = (params) => {
      return new ZodVoid({
        typeName: ZodFirstPartyTypeKind.ZodVoid,
        ...processCreateParams(params)
      });
    };
    ZodArray = class _ZodArray extends ZodType {
      _parse(input) {
        const { ctx, status } = this._processInputParams(input);
        const def = this._def;
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (def.exactLength !== null) {
          const tooBig = ctx.data.length > def.exactLength.value;
          const tooSmall = ctx.data.length < def.exactLength.value;
          if (tooBig || tooSmall) {
            addIssueToContext(ctx, {
              code: tooBig ? ZodIssueCode.too_big : ZodIssueCode.too_small,
              minimum: tooSmall ? def.exactLength.value : void 0,
              maximum: tooBig ? def.exactLength.value : void 0,
              type: "array",
              inclusive: true,
              exact: true,
              message: def.exactLength.message
            });
            status.dirty();
          }
        }
        if (def.minLength !== null) {
          if (ctx.data.length < def.minLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.minLength.message
            });
            status.dirty();
          }
        }
        if (def.maxLength !== null) {
          if (ctx.data.length > def.maxLength.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxLength.value,
              type: "array",
              inclusive: true,
              exact: false,
              message: def.maxLength.message
            });
            status.dirty();
          }
        }
        if (ctx.common.async) {
          return Promise.all([...ctx.data].map((item, i) => {
            return def.type._parseAsync(new ParseInputLazyPath(ctx, item, ctx.path, i));
          })).then((result2) => {
            return ParseStatus.mergeArray(status, result2);
          });
        }
        const result = [...ctx.data].map((item, i) => {
          return def.type._parseSync(new ParseInputLazyPath(ctx, item, ctx.path, i));
        });
        return ParseStatus.mergeArray(status, result);
      }
      get element() {
        return this._def.type;
      }
      min(minLength, message) {
        return new _ZodArray({
          ...this._def,
          minLength: { value: minLength, message: errorUtil.toString(message) }
        });
      }
      max(maxLength, message) {
        return new _ZodArray({
          ...this._def,
          maxLength: { value: maxLength, message: errorUtil.toString(message) }
        });
      }
      length(len, message) {
        return new _ZodArray({
          ...this._def,
          exactLength: { value: len, message: errorUtil.toString(message) }
        });
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodArray.create = (schema, params) => {
      return new ZodArray({
        type: schema,
        minLength: null,
        maxLength: null,
        exactLength: null,
        typeName: ZodFirstPartyTypeKind.ZodArray,
        ...processCreateParams(params)
      });
    };
    ZodObject = class _ZodObject extends ZodType {
      constructor() {
        super(...arguments);
        this._cached = null;
        this.nonstrict = this.passthrough;
        this.augment = this.extend;
      }
      _getCached() {
        if (this._cached !== null)
          return this._cached;
        const shape = this._def.shape();
        const keys = util.objectKeys(shape);
        this._cached = { shape, keys };
        return this._cached;
      }
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.object) {
          const ctx2 = this._getOrReturnCtx(input);
          addIssueToContext(ctx2, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx2.parsedType
          });
          return INVALID;
        }
        const { status, ctx } = this._processInputParams(input);
        const { shape, keys: shapeKeys } = this._getCached();
        const extraKeys = [];
        if (!(this._def.catchall instanceof ZodNever && this._def.unknownKeys === "strip")) {
          for (const key in ctx.data) {
            if (!shapeKeys.includes(key)) {
              extraKeys.push(key);
            }
          }
        }
        const pairs = [];
        for (const key of shapeKeys) {
          const keyValidator = shape[key];
          const value = ctx.data[key];
          pairs.push({
            key: { status: "valid", value: key },
            value: keyValidator._parse(new ParseInputLazyPath(ctx, value, ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (this._def.catchall instanceof ZodNever) {
          const unknownKeys = this._def.unknownKeys;
          if (unknownKeys === "passthrough") {
            for (const key of extraKeys) {
              pairs.push({
                key: { status: "valid", value: key },
                value: { status: "valid", value: ctx.data[key] }
              });
            }
          } else if (unknownKeys === "strict") {
            if (extraKeys.length > 0) {
              addIssueToContext(ctx, {
                code: ZodIssueCode.unrecognized_keys,
                keys: extraKeys
              });
              status.dirty();
            }
          } else if (unknownKeys === "strip") {
          } else {
            throw new Error(`Internal ZodObject error: invalid unknownKeys value.`);
          }
        } else {
          const catchall = this._def.catchall;
          for (const key of extraKeys) {
            const value = ctx.data[key];
            pairs.push({
              key: { status: "valid", value: key },
              value: catchall._parse(
                new ParseInputLazyPath(ctx, value, ctx.path, key)
                //, ctx.child(key), value, getParsedType(value)
              ),
              alwaysSet: key in ctx.data
            });
          }
        }
        if (ctx.common.async) {
          return Promise.resolve().then(async () => {
            const syncPairs = [];
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              syncPairs.push({
                key,
                value,
                alwaysSet: pair.alwaysSet
              });
            }
            return syncPairs;
          }).then((syncPairs) => {
            return ParseStatus.mergeObjectSync(status, syncPairs);
          });
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get shape() {
        return this._def.shape();
      }
      strict(message) {
        errorUtil.errToObj;
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strict",
          ...message !== void 0 ? {
            errorMap: (issue, ctx) => {
              const defaultError = this._def.errorMap?.(issue, ctx).message ?? ctx.defaultError;
              if (issue.code === "unrecognized_keys")
                return {
                  message: errorUtil.errToObj(message).message ?? defaultError
                };
              return {
                message: defaultError
              };
            }
          } : {}
        });
      }
      strip() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "strip"
        });
      }
      passthrough() {
        return new _ZodObject({
          ...this._def,
          unknownKeys: "passthrough"
        });
      }
      // const AugmentFactory =
      //   <Def extends ZodObjectDef>(def: Def) =>
      //   <Augmentation extends ZodRawShape>(
      //     augmentation: Augmentation
      //   ): ZodObject<
      //     extendShape<ReturnType<Def["shape"]>, Augmentation>,
      //     Def["unknownKeys"],
      //     Def["catchall"]
      //   > => {
      //     return new ZodObject({
      //       ...def,
      //       shape: () => ({
      //         ...def.shape(),
      //         ...augmentation,
      //       }),
      //     }) as any;
      //   };
      extend(augmentation) {
        return new _ZodObject({
          ...this._def,
          shape: () => ({
            ...this._def.shape(),
            ...augmentation
          })
        });
      }
      /**
       * Prior to zod@1.0.12 there was a bug in the
       * inferred type of merged objects. Please
       * upgrade if you are experiencing issues.
       */
      merge(merging) {
        const merged = new _ZodObject({
          unknownKeys: merging._def.unknownKeys,
          catchall: merging._def.catchall,
          shape: () => ({
            ...this._def.shape(),
            ...merging._def.shape()
          }),
          typeName: ZodFirstPartyTypeKind.ZodObject
        });
        return merged;
      }
      // merge<
      //   Incoming extends AnyZodObject,
      //   Augmentation extends Incoming["shape"],
      //   NewOutput extends {
      //     [k in keyof Augmentation | keyof Output]: k extends keyof Augmentation
      //       ? Augmentation[k]["_output"]
      //       : k extends keyof Output
      //       ? Output[k]
      //       : never;
      //   },
      //   NewInput extends {
      //     [k in keyof Augmentation | keyof Input]: k extends keyof Augmentation
      //       ? Augmentation[k]["_input"]
      //       : k extends keyof Input
      //       ? Input[k]
      //       : never;
      //   }
      // >(
      //   merging: Incoming
      // ): ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"],
      //   NewOutput,
      //   NewInput
      // > {
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      setKey(key, schema) {
        return this.augment({ [key]: schema });
      }
      // merge<Incoming extends AnyZodObject>(
      //   merging: Incoming
      // ): //ZodObject<T & Incoming["_shape"], UnknownKeys, Catchall> = (merging) => {
      // ZodObject<
      //   extendShape<T, ReturnType<Incoming["_def"]["shape"]>>,
      //   Incoming["_def"]["unknownKeys"],
      //   Incoming["_def"]["catchall"]
      // > {
      //   // const mergedShape = objectUtil.mergeShapes(
      //   //   this._def.shape(),
      //   //   merging._def.shape()
      //   // );
      //   const merged: any = new ZodObject({
      //     unknownKeys: merging._def.unknownKeys,
      //     catchall: merging._def.catchall,
      //     shape: () =>
      //       objectUtil.mergeShapes(this._def.shape(), merging._def.shape()),
      //     typeName: ZodFirstPartyTypeKind.ZodObject,
      //   }) as any;
      //   return merged;
      // }
      catchall(index) {
        return new _ZodObject({
          ...this._def,
          catchall: index
        });
      }
      pick(mask) {
        const shape = {};
        for (const key of util.objectKeys(mask)) {
          if (mask[key] && this.shape[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      omit(mask) {
        const shape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (!mask[key]) {
            shape[key] = this.shape[key];
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => shape
        });
      }
      /**
       * @deprecated
       */
      deepPartial() {
        return deepPartialify(this);
      }
      partial(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          const fieldSchema = this.shape[key];
          if (mask && !mask[key]) {
            newShape[key] = fieldSchema;
          } else {
            newShape[key] = fieldSchema.optional();
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      required(mask) {
        const newShape = {};
        for (const key of util.objectKeys(this.shape)) {
          if (mask && !mask[key]) {
            newShape[key] = this.shape[key];
          } else {
            const fieldSchema = this.shape[key];
            let newField = fieldSchema;
            while (newField instanceof ZodOptional) {
              newField = newField._def.innerType;
            }
            newShape[key] = newField;
          }
        }
        return new _ZodObject({
          ...this._def,
          shape: () => newShape
        });
      }
      keyof() {
        return createZodEnum(util.objectKeys(this.shape));
      }
    };
    ZodObject.create = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.strictCreate = (shape, params) => {
      return new ZodObject({
        shape: () => shape,
        unknownKeys: "strict",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodObject.lazycreate = (shape, params) => {
      return new ZodObject({
        shape,
        unknownKeys: "strip",
        catchall: ZodNever.create(),
        typeName: ZodFirstPartyTypeKind.ZodObject,
        ...processCreateParams(params)
      });
    };
    ZodUnion = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const options = this._def.options;
        function handleResults(results) {
          for (const result of results) {
            if (result.result.status === "valid") {
              return result.result;
            }
          }
          for (const result of results) {
            if (result.result.status === "dirty") {
              ctx.common.issues.push(...result.ctx.common.issues);
              return result.result;
            }
          }
          const unionErrors = results.map((result) => new ZodError(result.ctx.common.issues));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return Promise.all(options.map(async (option) => {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            return {
              result: await option._parseAsync({
                data: ctx.data,
                path: ctx.path,
                parent: childCtx
              }),
              ctx: childCtx
            };
          })).then(handleResults);
        } else {
          let dirty = void 0;
          const issues = [];
          for (const option of options) {
            const childCtx = {
              ...ctx,
              common: {
                ...ctx.common,
                issues: []
              },
              parent: null
            };
            const result = option._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: childCtx
            });
            if (result.status === "valid") {
              return result;
            } else if (result.status === "dirty" && !dirty) {
              dirty = { result, ctx: childCtx };
            }
            if (childCtx.common.issues.length) {
              issues.push(childCtx.common.issues);
            }
          }
          if (dirty) {
            ctx.common.issues.push(...dirty.ctx.common.issues);
            return dirty.result;
          }
          const unionErrors = issues.map((issues2) => new ZodError(issues2));
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union,
            unionErrors
          });
          return INVALID;
        }
      }
      get options() {
        return this._def.options;
      }
    };
    ZodUnion.create = (types, params) => {
      return new ZodUnion({
        options: types,
        typeName: ZodFirstPartyTypeKind.ZodUnion,
        ...processCreateParams(params)
      });
    };
    getDiscriminator = (type) => {
      if (type instanceof ZodLazy) {
        return getDiscriminator(type.schema);
      } else if (type instanceof ZodEffects) {
        return getDiscriminator(type.innerType());
      } else if (type instanceof ZodLiteral) {
        return [type.value];
      } else if (type instanceof ZodEnum) {
        return type.options;
      } else if (type instanceof ZodNativeEnum) {
        return util.objectValues(type.enum);
      } else if (type instanceof ZodDefault) {
        return getDiscriminator(type._def.innerType);
      } else if (type instanceof ZodUndefined) {
        return [void 0];
      } else if (type instanceof ZodNull) {
        return [null];
      } else if (type instanceof ZodOptional) {
        return [void 0, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodNullable) {
        return [null, ...getDiscriminator(type.unwrap())];
      } else if (type instanceof ZodBranded) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodReadonly) {
        return getDiscriminator(type.unwrap());
      } else if (type instanceof ZodCatch) {
        return getDiscriminator(type._def.innerType);
      } else {
        return [];
      }
    };
    ZodDiscriminatedUnion = class _ZodDiscriminatedUnion extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const discriminator = this.discriminator;
        const discriminatorValue = ctx.data[discriminator];
        const option = this.optionsMap.get(discriminatorValue);
        if (!option) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_union_discriminator,
            options: Array.from(this.optionsMap.keys()),
            path: [discriminator]
          });
          return INVALID;
        }
        if (ctx.common.async) {
          return option._parseAsync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        } else {
          return option._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
        }
      }
      get discriminator() {
        return this._def.discriminator;
      }
      get options() {
        return this._def.options;
      }
      get optionsMap() {
        return this._def.optionsMap;
      }
      /**
       * The constructor of the discriminated union schema. Its behaviour is very similar to that of the normal z.union() constructor.
       * However, it only allows a union of objects, all of which need to share a discriminator property. This property must
       * have a different value for each object in the union.
       * @param discriminator the name of the discriminator property
       * @param types an array of object schemas
       * @param params
       */
      static create(discriminator, options, params) {
        const optionsMap = /* @__PURE__ */ new Map();
        for (const type of options) {
          const discriminatorValues = getDiscriminator(type.shape[discriminator]);
          if (!discriminatorValues.length) {
            throw new Error(`A discriminator value for key \`${discriminator}\` could not be extracted from all schema options`);
          }
          for (const value of discriminatorValues) {
            if (optionsMap.has(value)) {
              throw new Error(`Discriminator property ${String(discriminator)} has duplicate value ${String(value)}`);
            }
            optionsMap.set(value, type);
          }
        }
        return new _ZodDiscriminatedUnion({
          typeName: ZodFirstPartyTypeKind.ZodDiscriminatedUnion,
          discriminator,
          options,
          optionsMap,
          ...processCreateParams(params)
        });
      }
    };
    ZodIntersection = class extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const handleParsed = (parsedLeft, parsedRight) => {
          if (isAborted(parsedLeft) || isAborted(parsedRight)) {
            return INVALID;
          }
          const merged = mergeValues(parsedLeft.value, parsedRight.value);
          if (!merged.valid) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.invalid_intersection_types
            });
            return INVALID;
          }
          if (isDirty(parsedLeft) || isDirty(parsedRight)) {
            status.dirty();
          }
          return { status: status.value, value: merged.data };
        };
        if (ctx.common.async) {
          return Promise.all([
            this._def.left._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            }),
            this._def.right._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            })
          ]).then(([left, right]) => handleParsed(left, right));
        } else {
          return handleParsed(this._def.left._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }), this._def.right._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          }));
        }
      }
    };
    ZodIntersection.create = (left, right, params) => {
      return new ZodIntersection({
        left,
        right,
        typeName: ZodFirstPartyTypeKind.ZodIntersection,
        ...processCreateParams(params)
      });
    };
    ZodTuple = class _ZodTuple extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.array) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.array,
            received: ctx.parsedType
          });
          return INVALID;
        }
        if (ctx.data.length < this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_small,
            minimum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          return INVALID;
        }
        const rest = this._def.rest;
        if (!rest && ctx.data.length > this._def.items.length) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.too_big,
            maximum: this._def.items.length,
            inclusive: true,
            exact: false,
            type: "array"
          });
          status.dirty();
        }
        const items = [...ctx.data].map((item, itemIndex) => {
          const schema = this._def.items[itemIndex] || this._def.rest;
          if (!schema)
            return null;
          return schema._parse(new ParseInputLazyPath(ctx, item, ctx.path, itemIndex));
        }).filter((x) => !!x);
        if (ctx.common.async) {
          return Promise.all(items).then((results) => {
            return ParseStatus.mergeArray(status, results);
          });
        } else {
          return ParseStatus.mergeArray(status, items);
        }
      }
      get items() {
        return this._def.items;
      }
      rest(rest) {
        return new _ZodTuple({
          ...this._def,
          rest
        });
      }
    };
    ZodTuple.create = (schemas, params) => {
      if (!Array.isArray(schemas)) {
        throw new Error("You must pass an array of schemas to z.tuple([ ... ])");
      }
      return new ZodTuple({
        items: schemas,
        typeName: ZodFirstPartyTypeKind.ZodTuple,
        rest: null,
        ...processCreateParams(params)
      });
    };
    ZodRecord = class _ZodRecord extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.object) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.object,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const pairs = [];
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        for (const key in ctx.data) {
          pairs.push({
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, key)),
            value: valueType._parse(new ParseInputLazyPath(ctx, ctx.data[key], ctx.path, key)),
            alwaysSet: key in ctx.data
          });
        }
        if (ctx.common.async) {
          return ParseStatus.mergeObjectAsync(status, pairs);
        } else {
          return ParseStatus.mergeObjectSync(status, pairs);
        }
      }
      get element() {
        return this._def.valueType;
      }
      static create(first, second, third) {
        if (second instanceof ZodType) {
          return new _ZodRecord({
            keyType: first,
            valueType: second,
            typeName: ZodFirstPartyTypeKind.ZodRecord,
            ...processCreateParams(third)
          });
        }
        return new _ZodRecord({
          keyType: ZodString.create(),
          valueType: first,
          typeName: ZodFirstPartyTypeKind.ZodRecord,
          ...processCreateParams(second)
        });
      }
    };
    ZodMap = class extends ZodType {
      get keySchema() {
        return this._def.keyType;
      }
      get valueSchema() {
        return this._def.valueType;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.map) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.map,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const keyType = this._def.keyType;
        const valueType = this._def.valueType;
        const pairs = [...ctx.data.entries()].map(([key, value], index) => {
          return {
            key: keyType._parse(new ParseInputLazyPath(ctx, key, ctx.path, [index, "key"])),
            value: valueType._parse(new ParseInputLazyPath(ctx, value, ctx.path, [index, "value"]))
          };
        });
        if (ctx.common.async) {
          const finalMap = /* @__PURE__ */ new Map();
          return Promise.resolve().then(async () => {
            for (const pair of pairs) {
              const key = await pair.key;
              const value = await pair.value;
              if (key.status === "aborted" || value.status === "aborted") {
                return INVALID;
              }
              if (key.status === "dirty" || value.status === "dirty") {
                status.dirty();
              }
              finalMap.set(key.value, value.value);
            }
            return { status: status.value, value: finalMap };
          });
        } else {
          const finalMap = /* @__PURE__ */ new Map();
          for (const pair of pairs) {
            const key = pair.key;
            const value = pair.value;
            if (key.status === "aborted" || value.status === "aborted") {
              return INVALID;
            }
            if (key.status === "dirty" || value.status === "dirty") {
              status.dirty();
            }
            finalMap.set(key.value, value.value);
          }
          return { status: status.value, value: finalMap };
        }
      }
    };
    ZodMap.create = (keyType, valueType, params) => {
      return new ZodMap({
        valueType,
        keyType,
        typeName: ZodFirstPartyTypeKind.ZodMap,
        ...processCreateParams(params)
      });
    };
    ZodSet = class _ZodSet extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.set) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.set,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const def = this._def;
        if (def.minSize !== null) {
          if (ctx.data.size < def.minSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_small,
              minimum: def.minSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.minSize.message
            });
            status.dirty();
          }
        }
        if (def.maxSize !== null) {
          if (ctx.data.size > def.maxSize.value) {
            addIssueToContext(ctx, {
              code: ZodIssueCode.too_big,
              maximum: def.maxSize.value,
              type: "set",
              inclusive: true,
              exact: false,
              message: def.maxSize.message
            });
            status.dirty();
          }
        }
        const valueType = this._def.valueType;
        function finalizeSet(elements2) {
          const parsedSet = /* @__PURE__ */ new Set();
          for (const element of elements2) {
            if (element.status === "aborted")
              return INVALID;
            if (element.status === "dirty")
              status.dirty();
            parsedSet.add(element.value);
          }
          return { status: status.value, value: parsedSet };
        }
        const elements = [...ctx.data.values()].map((item, i) => valueType._parse(new ParseInputLazyPath(ctx, item, ctx.path, i)));
        if (ctx.common.async) {
          return Promise.all(elements).then((elements2) => finalizeSet(elements2));
        } else {
          return finalizeSet(elements);
        }
      }
      min(minSize, message) {
        return new _ZodSet({
          ...this._def,
          minSize: { value: minSize, message: errorUtil.toString(message) }
        });
      }
      max(maxSize, message) {
        return new _ZodSet({
          ...this._def,
          maxSize: { value: maxSize, message: errorUtil.toString(message) }
        });
      }
      size(size, message) {
        return this.min(size, message).max(size, message);
      }
      nonempty(message) {
        return this.min(1, message);
      }
    };
    ZodSet.create = (valueType, params) => {
      return new ZodSet({
        valueType,
        minSize: null,
        maxSize: null,
        typeName: ZodFirstPartyTypeKind.ZodSet,
        ...processCreateParams(params)
      });
    };
    ZodFunction = class _ZodFunction extends ZodType {
      constructor() {
        super(...arguments);
        this.validate = this.implement;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.function) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.function,
            received: ctx.parsedType
          });
          return INVALID;
        }
        function makeArgsIssue(args, error) {
          return makeIssue({
            data: args,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_arguments,
              argumentsError: error
            }
          });
        }
        function makeReturnsIssue(returns, error) {
          return makeIssue({
            data: returns,
            path: ctx.path,
            errorMaps: [ctx.common.contextualErrorMap, ctx.schemaErrorMap, getErrorMap(), en_default].filter((x) => !!x),
            issueData: {
              code: ZodIssueCode.invalid_return_type,
              returnTypeError: error
            }
          });
        }
        const params = { errorMap: ctx.common.contextualErrorMap };
        const fn = ctx.data;
        if (this._def.returns instanceof ZodPromise) {
          const me = this;
          return OK(async function(...args) {
            const error = new ZodError([]);
            const parsedArgs = await me._def.args.parseAsync(args, params).catch((e) => {
              error.addIssue(makeArgsIssue(args, e));
              throw error;
            });
            const result = await Reflect.apply(fn, this, parsedArgs);
            const parsedReturns = await me._def.returns._def.type.parseAsync(result, params).catch((e) => {
              error.addIssue(makeReturnsIssue(result, e));
              throw error;
            });
            return parsedReturns;
          });
        } else {
          const me = this;
          return OK(function(...args) {
            const parsedArgs = me._def.args.safeParse(args, params);
            if (!parsedArgs.success) {
              throw new ZodError([makeArgsIssue(args, parsedArgs.error)]);
            }
            const result = Reflect.apply(fn, this, parsedArgs.data);
            const parsedReturns = me._def.returns.safeParse(result, params);
            if (!parsedReturns.success) {
              throw new ZodError([makeReturnsIssue(result, parsedReturns.error)]);
            }
            return parsedReturns.data;
          });
        }
      }
      parameters() {
        return this._def.args;
      }
      returnType() {
        return this._def.returns;
      }
      args(...items) {
        return new _ZodFunction({
          ...this._def,
          args: ZodTuple.create(items).rest(ZodUnknown.create())
        });
      }
      returns(returnType) {
        return new _ZodFunction({
          ...this._def,
          returns: returnType
        });
      }
      implement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      strictImplement(func) {
        const validatedFunc = this.parse(func);
        return validatedFunc;
      }
      static create(args, returns, params) {
        return new _ZodFunction({
          args: args ? args : ZodTuple.create([]).rest(ZodUnknown.create()),
          returns: returns || ZodUnknown.create(),
          typeName: ZodFirstPartyTypeKind.ZodFunction,
          ...processCreateParams(params)
        });
      }
    };
    ZodLazy = class extends ZodType {
      get schema() {
        return this._def.getter();
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const lazySchema = this._def.getter();
        return lazySchema._parse({ data: ctx.data, path: ctx.path, parent: ctx });
      }
    };
    ZodLazy.create = (getter, params) => {
      return new ZodLazy({
        getter,
        typeName: ZodFirstPartyTypeKind.ZodLazy,
        ...processCreateParams(params)
      });
    };
    ZodLiteral = class extends ZodType {
      _parse(input) {
        if (input.data !== this._def.value) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_literal,
            expected: this._def.value
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
      get value() {
        return this._def.value;
      }
    };
    ZodLiteral.create = (value, params) => {
      return new ZodLiteral({
        value,
        typeName: ZodFirstPartyTypeKind.ZodLiteral,
        ...processCreateParams(params)
      });
    };
    ZodEnum = class _ZodEnum extends ZodType {
      _parse(input) {
        if (typeof input.data !== "string") {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(this._def.values);
        }
        if (!this._cache.has(input.data)) {
          const ctx = this._getOrReturnCtx(input);
          const expectedValues = this._def.values;
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get options() {
        return this._def.values;
      }
      get enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Values() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      get Enum() {
        const enumValues = {};
        for (const val of this._def.values) {
          enumValues[val] = val;
        }
        return enumValues;
      }
      extract(values, newDef = this._def) {
        return _ZodEnum.create(values, {
          ...this._def,
          ...newDef
        });
      }
      exclude(values, newDef = this._def) {
        return _ZodEnum.create(this.options.filter((opt) => !values.includes(opt)), {
          ...this._def,
          ...newDef
        });
      }
    };
    ZodEnum.create = createZodEnum;
    ZodNativeEnum = class extends ZodType {
      _parse(input) {
        const nativeEnumValues = util.getValidEnumValues(this._def.values);
        const ctx = this._getOrReturnCtx(input);
        if (ctx.parsedType !== ZodParsedType.string && ctx.parsedType !== ZodParsedType.number) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            expected: util.joinValues(expectedValues),
            received: ctx.parsedType,
            code: ZodIssueCode.invalid_type
          });
          return INVALID;
        }
        if (!this._cache) {
          this._cache = new Set(util.getValidEnumValues(this._def.values));
        }
        if (!this._cache.has(input.data)) {
          const expectedValues = util.objectValues(nativeEnumValues);
          addIssueToContext(ctx, {
            received: ctx.data,
            code: ZodIssueCode.invalid_enum_value,
            options: expectedValues
          });
          return INVALID;
        }
        return OK(input.data);
      }
      get enum() {
        return this._def.values;
      }
    };
    ZodNativeEnum.create = (values, params) => {
      return new ZodNativeEnum({
        values,
        typeName: ZodFirstPartyTypeKind.ZodNativeEnum,
        ...processCreateParams(params)
      });
    };
    ZodPromise = class extends ZodType {
      unwrap() {
        return this._def.type;
      }
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        if (ctx.parsedType !== ZodParsedType.promise && ctx.common.async === false) {
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.promise,
            received: ctx.parsedType
          });
          return INVALID;
        }
        const promisified = ctx.parsedType === ZodParsedType.promise ? ctx.data : Promise.resolve(ctx.data);
        return OK(promisified.then((data) => {
          return this._def.type.parseAsync(data, {
            path: ctx.path,
            errorMap: ctx.common.contextualErrorMap
          });
        }));
      }
    };
    ZodPromise.create = (schema, params) => {
      return new ZodPromise({
        type: schema,
        typeName: ZodFirstPartyTypeKind.ZodPromise,
        ...processCreateParams(params)
      });
    };
    ZodEffects = class extends ZodType {
      innerType() {
        return this._def.schema;
      }
      sourceType() {
        return this._def.schema._def.typeName === ZodFirstPartyTypeKind.ZodEffects ? this._def.schema.sourceType() : this._def.schema;
      }
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        const effect = this._def.effect || null;
        const checkCtx = {
          addIssue: (arg) => {
            addIssueToContext(ctx, arg);
            if (arg.fatal) {
              status.abort();
            } else {
              status.dirty();
            }
          },
          get path() {
            return ctx.path;
          }
        };
        checkCtx.addIssue = checkCtx.addIssue.bind(checkCtx);
        if (effect.type === "preprocess") {
          const processed = effect.transform(ctx.data, checkCtx);
          if (ctx.common.async) {
            return Promise.resolve(processed).then(async (processed2) => {
              if (status.value === "aborted")
                return INVALID;
              const result = await this._def.schema._parseAsync({
                data: processed2,
                path: ctx.path,
                parent: ctx
              });
              if (result.status === "aborted")
                return INVALID;
              if (result.status === "dirty")
                return DIRTY(result.value);
              if (status.value === "dirty")
                return DIRTY(result.value);
              return result;
            });
          } else {
            if (status.value === "aborted")
              return INVALID;
            const result = this._def.schema._parseSync({
              data: processed,
              path: ctx.path,
              parent: ctx
            });
            if (result.status === "aborted")
              return INVALID;
            if (result.status === "dirty")
              return DIRTY(result.value);
            if (status.value === "dirty")
              return DIRTY(result.value);
            return result;
          }
        }
        if (effect.type === "refinement") {
          const executeRefinement = (acc) => {
            const result = effect.refinement(acc, checkCtx);
            if (ctx.common.async) {
              return Promise.resolve(result);
            }
            if (result instanceof Promise) {
              throw new Error("Async refinement encountered during synchronous parse operation. Use .parseAsync instead.");
            }
            return acc;
          };
          if (ctx.common.async === false) {
            const inner = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inner.status === "aborted")
              return INVALID;
            if (inner.status === "dirty")
              status.dirty();
            executeRefinement(inner.value);
            return { status: status.value, value: inner.value };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((inner) => {
              if (inner.status === "aborted")
                return INVALID;
              if (inner.status === "dirty")
                status.dirty();
              return executeRefinement(inner.value).then(() => {
                return { status: status.value, value: inner.value };
              });
            });
          }
        }
        if (effect.type === "transform") {
          if (ctx.common.async === false) {
            const base = this._def.schema._parseSync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (!isValid(base))
              return INVALID;
            const result = effect.transform(base.value, checkCtx);
            if (result instanceof Promise) {
              throw new Error(`Asynchronous transform encountered during synchronous parse operation. Use .parseAsync instead.`);
            }
            return { status: status.value, value: result };
          } else {
            return this._def.schema._parseAsync({ data: ctx.data, path: ctx.path, parent: ctx }).then((base) => {
              if (!isValid(base))
                return INVALID;
              return Promise.resolve(effect.transform(base.value, checkCtx)).then((result) => ({
                status: status.value,
                value: result
              }));
            });
          }
        }
        util.assertNever(effect);
      }
    };
    ZodEffects.create = (schema, effect, params) => {
      return new ZodEffects({
        schema,
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        effect,
        ...processCreateParams(params)
      });
    };
    ZodEffects.createWithPreprocess = (preprocess, schema, params) => {
      return new ZodEffects({
        schema,
        effect: { type: "preprocess", transform: preprocess },
        typeName: ZodFirstPartyTypeKind.ZodEffects,
        ...processCreateParams(params)
      });
    };
    ZodOptional = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.undefined) {
          return OK(void 0);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodOptional.create = (type, params) => {
      return new ZodOptional({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodOptional,
        ...processCreateParams(params)
      });
    };
    ZodNullable = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType === ZodParsedType.null) {
          return OK(null);
        }
        return this._def.innerType._parse(input);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodNullable.create = (type, params) => {
      return new ZodNullable({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodNullable,
        ...processCreateParams(params)
      });
    };
    ZodDefault = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        let data = ctx.data;
        if (ctx.parsedType === ZodParsedType.undefined) {
          data = this._def.defaultValue();
        }
        return this._def.innerType._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      removeDefault() {
        return this._def.innerType;
      }
    };
    ZodDefault.create = (type, params) => {
      return new ZodDefault({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodDefault,
        defaultValue: typeof params.default === "function" ? params.default : () => params.default,
        ...processCreateParams(params)
      });
    };
    ZodCatch = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const newCtx = {
          ...ctx,
          common: {
            ...ctx.common,
            issues: []
          }
        };
        const result = this._def.innerType._parse({
          data: newCtx.data,
          path: newCtx.path,
          parent: {
            ...newCtx
          }
        });
        if (isAsync(result)) {
          return result.then((result2) => {
            return {
              status: "valid",
              value: result2.status === "valid" ? result2.value : this._def.catchValue({
                get error() {
                  return new ZodError(newCtx.common.issues);
                },
                input: newCtx.data
              })
            };
          });
        } else {
          return {
            status: "valid",
            value: result.status === "valid" ? result.value : this._def.catchValue({
              get error() {
                return new ZodError(newCtx.common.issues);
              },
              input: newCtx.data
            })
          };
        }
      }
      removeCatch() {
        return this._def.innerType;
      }
    };
    ZodCatch.create = (type, params) => {
      return new ZodCatch({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodCatch,
        catchValue: typeof params.catch === "function" ? params.catch : () => params.catch,
        ...processCreateParams(params)
      });
    };
    ZodNaN = class extends ZodType {
      _parse(input) {
        const parsedType = this._getType(input);
        if (parsedType !== ZodParsedType.nan) {
          const ctx = this._getOrReturnCtx(input);
          addIssueToContext(ctx, {
            code: ZodIssueCode.invalid_type,
            expected: ZodParsedType.nan,
            received: ctx.parsedType
          });
          return INVALID;
        }
        return { status: "valid", value: input.data };
      }
    };
    ZodNaN.create = (params) => {
      return new ZodNaN({
        typeName: ZodFirstPartyTypeKind.ZodNaN,
        ...processCreateParams(params)
      });
    };
    BRAND = /* @__PURE__ */ Symbol("zod_brand");
    ZodBranded = class extends ZodType {
      _parse(input) {
        const { ctx } = this._processInputParams(input);
        const data = ctx.data;
        return this._def.type._parse({
          data,
          path: ctx.path,
          parent: ctx
        });
      }
      unwrap() {
        return this._def.type;
      }
    };
    ZodPipeline = class _ZodPipeline extends ZodType {
      _parse(input) {
        const { status, ctx } = this._processInputParams(input);
        if (ctx.common.async) {
          const handleAsync = async () => {
            const inResult = await this._def.in._parseAsync({
              data: ctx.data,
              path: ctx.path,
              parent: ctx
            });
            if (inResult.status === "aborted")
              return INVALID;
            if (inResult.status === "dirty") {
              status.dirty();
              return DIRTY(inResult.value);
            } else {
              return this._def.out._parseAsync({
                data: inResult.value,
                path: ctx.path,
                parent: ctx
              });
            }
          };
          return handleAsync();
        } else {
          const inResult = this._def.in._parseSync({
            data: ctx.data,
            path: ctx.path,
            parent: ctx
          });
          if (inResult.status === "aborted")
            return INVALID;
          if (inResult.status === "dirty") {
            status.dirty();
            return {
              status: "dirty",
              value: inResult.value
            };
          } else {
            return this._def.out._parseSync({
              data: inResult.value,
              path: ctx.path,
              parent: ctx
            });
          }
        }
      }
      static create(a, b) {
        return new _ZodPipeline({
          in: a,
          out: b,
          typeName: ZodFirstPartyTypeKind.ZodPipeline
        });
      }
    };
    ZodReadonly = class extends ZodType {
      _parse(input) {
        const result = this._def.innerType._parse(input);
        const freeze = (data) => {
          if (isValid(data)) {
            data.value = Object.freeze(data.value);
          }
          return data;
        };
        return isAsync(result) ? result.then((data) => freeze(data)) : freeze(result);
      }
      unwrap() {
        return this._def.innerType;
      }
    };
    ZodReadonly.create = (type, params) => {
      return new ZodReadonly({
        innerType: type,
        typeName: ZodFirstPartyTypeKind.ZodReadonly,
        ...processCreateParams(params)
      });
    };
    late = {
      object: ZodObject.lazycreate
    };
    (function(ZodFirstPartyTypeKind2) {
      ZodFirstPartyTypeKind2["ZodString"] = "ZodString";
      ZodFirstPartyTypeKind2["ZodNumber"] = "ZodNumber";
      ZodFirstPartyTypeKind2["ZodNaN"] = "ZodNaN";
      ZodFirstPartyTypeKind2["ZodBigInt"] = "ZodBigInt";
      ZodFirstPartyTypeKind2["ZodBoolean"] = "ZodBoolean";
      ZodFirstPartyTypeKind2["ZodDate"] = "ZodDate";
      ZodFirstPartyTypeKind2["ZodSymbol"] = "ZodSymbol";
      ZodFirstPartyTypeKind2["ZodUndefined"] = "ZodUndefined";
      ZodFirstPartyTypeKind2["ZodNull"] = "ZodNull";
      ZodFirstPartyTypeKind2["ZodAny"] = "ZodAny";
      ZodFirstPartyTypeKind2["ZodUnknown"] = "ZodUnknown";
      ZodFirstPartyTypeKind2["ZodNever"] = "ZodNever";
      ZodFirstPartyTypeKind2["ZodVoid"] = "ZodVoid";
      ZodFirstPartyTypeKind2["ZodArray"] = "ZodArray";
      ZodFirstPartyTypeKind2["ZodObject"] = "ZodObject";
      ZodFirstPartyTypeKind2["ZodUnion"] = "ZodUnion";
      ZodFirstPartyTypeKind2["ZodDiscriminatedUnion"] = "ZodDiscriminatedUnion";
      ZodFirstPartyTypeKind2["ZodIntersection"] = "ZodIntersection";
      ZodFirstPartyTypeKind2["ZodTuple"] = "ZodTuple";
      ZodFirstPartyTypeKind2["ZodRecord"] = "ZodRecord";
      ZodFirstPartyTypeKind2["ZodMap"] = "ZodMap";
      ZodFirstPartyTypeKind2["ZodSet"] = "ZodSet";
      ZodFirstPartyTypeKind2["ZodFunction"] = "ZodFunction";
      ZodFirstPartyTypeKind2["ZodLazy"] = "ZodLazy";
      ZodFirstPartyTypeKind2["ZodLiteral"] = "ZodLiteral";
      ZodFirstPartyTypeKind2["ZodEnum"] = "ZodEnum";
      ZodFirstPartyTypeKind2["ZodEffects"] = "ZodEffects";
      ZodFirstPartyTypeKind2["ZodNativeEnum"] = "ZodNativeEnum";
      ZodFirstPartyTypeKind2["ZodOptional"] = "ZodOptional";
      ZodFirstPartyTypeKind2["ZodNullable"] = "ZodNullable";
      ZodFirstPartyTypeKind2["ZodDefault"] = "ZodDefault";
      ZodFirstPartyTypeKind2["ZodCatch"] = "ZodCatch";
      ZodFirstPartyTypeKind2["ZodPromise"] = "ZodPromise";
      ZodFirstPartyTypeKind2["ZodBranded"] = "ZodBranded";
      ZodFirstPartyTypeKind2["ZodPipeline"] = "ZodPipeline";
      ZodFirstPartyTypeKind2["ZodReadonly"] = "ZodReadonly";
    })(ZodFirstPartyTypeKind || (ZodFirstPartyTypeKind = {}));
    instanceOfType = (cls, params = {
      message: `Input not instance of ${cls.name}`
    }) => custom((data) => data instanceof cls, params);
    stringType = ZodString.create;
    numberType = ZodNumber.create;
    nanType = ZodNaN.create;
    bigIntType = ZodBigInt.create;
    booleanType = ZodBoolean.create;
    dateType = ZodDate.create;
    symbolType = ZodSymbol.create;
    undefinedType = ZodUndefined.create;
    nullType = ZodNull.create;
    anyType = ZodAny.create;
    unknownType = ZodUnknown.create;
    neverType = ZodNever.create;
    voidType = ZodVoid.create;
    arrayType = ZodArray.create;
    objectType = ZodObject.create;
    strictObjectType = ZodObject.strictCreate;
    unionType = ZodUnion.create;
    discriminatedUnionType = ZodDiscriminatedUnion.create;
    intersectionType = ZodIntersection.create;
    tupleType = ZodTuple.create;
    recordType = ZodRecord.create;
    mapType = ZodMap.create;
    setType = ZodSet.create;
    functionType = ZodFunction.create;
    lazyType = ZodLazy.create;
    literalType = ZodLiteral.create;
    enumType = ZodEnum.create;
    nativeEnumType = ZodNativeEnum.create;
    promiseType = ZodPromise.create;
    effectsType = ZodEffects.create;
    optionalType = ZodOptional.create;
    nullableType = ZodNullable.create;
    preprocessType = ZodEffects.createWithPreprocess;
    pipelineType = ZodPipeline.create;
    ostring = () => stringType().optional();
    onumber = () => numberType().optional();
    oboolean = () => booleanType().optional();
    coerce = {
      string: ((arg) => ZodString.create({ ...arg, coerce: true })),
      number: ((arg) => ZodNumber.create({ ...arg, coerce: true })),
      boolean: ((arg) => ZodBoolean.create({
        ...arg,
        coerce: true
      })),
      bigint: ((arg) => ZodBigInt.create({ ...arg, coerce: true })),
      date: ((arg) => ZodDate.create({ ...arg, coerce: true }))
    };
    NEVER = INVALID;
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js
var external_exports = {};
__export(external_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType
});
var init_external = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/v3/external.js"() {
    init_errors();
    init_parseUtil();
    init_typeAliases();
    init_util();
    init_types();
    init_ZodError();
  }
});

// ../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js
var zod_exports = {};
__export(zod_exports, {
  BRAND: () => BRAND,
  DIRTY: () => DIRTY,
  EMPTY_PATH: () => EMPTY_PATH,
  INVALID: () => INVALID,
  NEVER: () => NEVER,
  OK: () => OK,
  ParseStatus: () => ParseStatus,
  Schema: () => ZodType,
  ZodAny: () => ZodAny,
  ZodArray: () => ZodArray,
  ZodBigInt: () => ZodBigInt,
  ZodBoolean: () => ZodBoolean,
  ZodBranded: () => ZodBranded,
  ZodCatch: () => ZodCatch,
  ZodDate: () => ZodDate,
  ZodDefault: () => ZodDefault,
  ZodDiscriminatedUnion: () => ZodDiscriminatedUnion,
  ZodEffects: () => ZodEffects,
  ZodEnum: () => ZodEnum,
  ZodError: () => ZodError,
  ZodFirstPartyTypeKind: () => ZodFirstPartyTypeKind,
  ZodFunction: () => ZodFunction,
  ZodIntersection: () => ZodIntersection,
  ZodIssueCode: () => ZodIssueCode,
  ZodLazy: () => ZodLazy,
  ZodLiteral: () => ZodLiteral,
  ZodMap: () => ZodMap,
  ZodNaN: () => ZodNaN,
  ZodNativeEnum: () => ZodNativeEnum,
  ZodNever: () => ZodNever,
  ZodNull: () => ZodNull,
  ZodNullable: () => ZodNullable,
  ZodNumber: () => ZodNumber,
  ZodObject: () => ZodObject,
  ZodOptional: () => ZodOptional,
  ZodParsedType: () => ZodParsedType,
  ZodPipeline: () => ZodPipeline,
  ZodPromise: () => ZodPromise,
  ZodReadonly: () => ZodReadonly,
  ZodRecord: () => ZodRecord,
  ZodSchema: () => ZodType,
  ZodSet: () => ZodSet,
  ZodString: () => ZodString,
  ZodSymbol: () => ZodSymbol,
  ZodTransformer: () => ZodEffects,
  ZodTuple: () => ZodTuple,
  ZodType: () => ZodType,
  ZodUndefined: () => ZodUndefined,
  ZodUnion: () => ZodUnion,
  ZodUnknown: () => ZodUnknown,
  ZodVoid: () => ZodVoid,
  addIssueToContext: () => addIssueToContext,
  any: () => anyType,
  array: () => arrayType,
  bigint: () => bigIntType,
  boolean: () => booleanType,
  coerce: () => coerce,
  custom: () => custom,
  date: () => dateType,
  datetimeRegex: () => datetimeRegex,
  default: () => zod_default,
  defaultErrorMap: () => en_default,
  discriminatedUnion: () => discriminatedUnionType,
  effect: () => effectsType,
  enum: () => enumType,
  function: () => functionType,
  getErrorMap: () => getErrorMap,
  getParsedType: () => getParsedType,
  instanceof: () => instanceOfType,
  intersection: () => intersectionType,
  isAborted: () => isAborted,
  isAsync: () => isAsync,
  isDirty: () => isDirty,
  isValid: () => isValid,
  late: () => late,
  lazy: () => lazyType,
  literal: () => literalType,
  makeIssue: () => makeIssue,
  map: () => mapType,
  nan: () => nanType,
  nativeEnum: () => nativeEnumType,
  never: () => neverType,
  null: () => nullType,
  nullable: () => nullableType,
  number: () => numberType,
  object: () => objectType,
  objectUtil: () => objectUtil,
  oboolean: () => oboolean,
  onumber: () => onumber,
  optional: () => optionalType,
  ostring: () => ostring,
  pipeline: () => pipelineType,
  preprocess: () => preprocessType,
  promise: () => promiseType,
  quotelessJson: () => quotelessJson,
  record: () => recordType,
  set: () => setType,
  setErrorMap: () => setErrorMap,
  strictObject: () => strictObjectType,
  string: () => stringType,
  symbol: () => symbolType,
  transformer: () => effectsType,
  tuple: () => tupleType,
  undefined: () => undefinedType,
  union: () => unionType,
  unknown: () => unknownType,
  util: () => util,
  void: () => voidType,
  z: () => external_exports
});
var zod_default;
var init_zod = __esm({
  "../../node_modules/.pnpm/zod@3.25.76/node_modules/zod/index.js"() {
    init_external();
    init_external();
    zod_default = external_exports;
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/constants.js
var require_constants = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/constants.js"(exports, module) {
    "use strict";
    var BINARY_TYPES = ["nodebuffer", "arraybuffer", "fragments"];
    var hasBlob = typeof Blob !== "undefined";
    if (hasBlob) BINARY_TYPES.push("blob");
    module.exports = {
      BINARY_TYPES,
      CLOSE_TIMEOUT: 3e4,
      EMPTY_BUFFER: Buffer.alloc(0),
      GUID: "258EAFA5-E914-47DA-95CA-C5AB0DC85B11",
      hasBlob,
      kForOnEventAttribute: /* @__PURE__ */ Symbol("kIsForOnEventAttribute"),
      kListener: /* @__PURE__ */ Symbol("kListener"),
      kStatusCode: /* @__PURE__ */ Symbol("status-code"),
      kWebSocket: /* @__PURE__ */ Symbol("websocket"),
      NOOP: () => {
      }
    };
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/buffer-util.js
var require_buffer_util = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/buffer-util.js"(exports, module) {
    "use strict";
    var { EMPTY_BUFFER } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    function concat(list, totalLength) {
      if (list.length === 0) return EMPTY_BUFFER;
      if (list.length === 1) return list[0];
      const target = Buffer.allocUnsafe(totalLength);
      let offset = 0;
      for (let i = 0; i < list.length; i++) {
        const buf = list[i];
        target.set(buf, offset);
        offset += buf.length;
      }
      if (offset < totalLength) {
        return new FastBuffer(target.buffer, target.byteOffset, offset);
      }
      return target;
    }
    function _mask(source, mask, output, offset, length) {
      for (let i = 0; i < length; i++) {
        output[offset + i] = source[i] ^ mask[i & 3];
      }
    }
    function _unmask(buffer, mask) {
      for (let i = 0; i < buffer.length; i++) {
        buffer[i] ^= mask[i & 3];
      }
    }
    function toArrayBuffer(buf) {
      if (buf.length === buf.buffer.byteLength) {
        return buf.buffer;
      }
      return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.length);
    }
    function toBuffer(data) {
      toBuffer.readOnly = true;
      if (Buffer.isBuffer(data)) return data;
      let buf;
      if (data instanceof ArrayBuffer) {
        buf = new FastBuffer(data);
      } else if (ArrayBuffer.isView(data)) {
        buf = new FastBuffer(data.buffer, data.byteOffset, data.byteLength);
      } else {
        buf = Buffer.from(data);
        toBuffer.readOnly = false;
      }
      return buf;
    }
    module.exports = {
      concat,
      mask: _mask,
      toArrayBuffer,
      toBuffer,
      unmask: _unmask
    };
    if (!process.env.WS_NO_BUFFER_UTIL) {
      try {
        const bufferUtil = __require("bufferutil");
        module.exports.mask = function(source, mask, output, offset, length) {
          if (length < 48) _mask(source, mask, output, offset, length);
          else bufferUtil.mask(source, mask, output, offset, length);
        };
        module.exports.unmask = function(buffer, mask) {
          if (buffer.length < 32) _unmask(buffer, mask);
          else bufferUtil.unmask(buffer, mask);
        };
      } catch (e) {
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/limiter.js
var require_limiter = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/limiter.js"(exports, module) {
    "use strict";
    var kDone = /* @__PURE__ */ Symbol("kDone");
    var kRun = /* @__PURE__ */ Symbol("kRun");
    var Limiter = class {
      /**
       * Creates a new `Limiter`.
       *
       * @param {Number} [concurrency=Infinity] The maximum number of jobs allowed
       *     to run concurrently
       */
      constructor(concurrency) {
        this[kDone] = () => {
          this.pending--;
          this[kRun]();
        };
        this.concurrency = concurrency || Infinity;
        this.jobs = [];
        this.pending = 0;
      }
      /**
       * Adds a job to the queue.
       *
       * @param {Function} job The job to run
       * @public
       */
      add(job) {
        this.jobs.push(job);
        this[kRun]();
      }
      /**
       * Removes a job from the queue and runs it if possible.
       *
       * @private
       */
      [kRun]() {
        if (this.pending === this.concurrency) return;
        if (this.jobs.length) {
          const job = this.jobs.shift();
          this.pending++;
          job(this[kDone]);
        }
      }
    };
    module.exports = Limiter;
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/permessage-deflate.js
var require_permessage_deflate = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/permessage-deflate.js"(exports, module) {
    "use strict";
    var zlib = __require("zlib");
    var bufferUtil = require_buffer_util();
    var Limiter = require_limiter();
    var { kStatusCode } = require_constants();
    var FastBuffer = Buffer[Symbol.species];
    var TRAILER = Buffer.from([0, 0, 255, 255]);
    var kPerMessageDeflate = /* @__PURE__ */ Symbol("permessage-deflate");
    var kTotalLength = /* @__PURE__ */ Symbol("total-length");
    var kCallback = /* @__PURE__ */ Symbol("callback");
    var kBuffers = /* @__PURE__ */ Symbol("buffers");
    var kError = /* @__PURE__ */ Symbol("error");
    var zlibLimiter;
    var PerMessageDeflate2 = class {
      /**
       * Creates a PerMessageDeflate instance.
       *
       * @param {Object} [options] Configuration options
       * @param {(Boolean|Number)} [options.clientMaxWindowBits] Advertise support
       *     for, or request, a custom client window size
       * @param {Boolean} [options.clientNoContextTakeover=false] Advertise/
       *     acknowledge disabling of client context takeover
       * @param {Number} [options.concurrencyLimit=10] The number of concurrent
       *     calls to zlib
       * @param {Boolean} [options.isServer=false] Create the instance in either
       *     server or client mode
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {(Boolean|Number)} [options.serverMaxWindowBits] Request/confirm the
       *     use of a custom server window size
       * @param {Boolean} [options.serverNoContextTakeover=false] Request/accept
       *     disabling of server context takeover
       * @param {Number} [options.threshold=1024] Size (in bytes) below which
       *     messages should not be compressed if context takeover is disabled
       * @param {Object} [options.zlibDeflateOptions] Options to pass to zlib on
       *     deflate
       * @param {Object} [options.zlibInflateOptions] Options to pass to zlib on
       *     inflate
       */
      constructor(options) {
        this._options = options || {};
        this._threshold = this._options.threshold !== void 0 ? this._options.threshold : 1024;
        this._maxPayload = this._options.maxPayload | 0;
        this._isServer = !!this._options.isServer;
        this._deflate = null;
        this._inflate = null;
        this.params = null;
        if (!zlibLimiter) {
          const concurrency = this._options.concurrencyLimit !== void 0 ? this._options.concurrencyLimit : 10;
          zlibLimiter = new Limiter(concurrency);
        }
      }
      /**
       * @type {String}
       */
      static get extensionName() {
        return "permessage-deflate";
      }
      /**
       * Create an extension negotiation offer.
       *
       * @return {Object} Extension parameters
       * @public
       */
      offer() {
        const params = {};
        if (this._options.serverNoContextTakeover) {
          params.server_no_context_takeover = true;
        }
        if (this._options.clientNoContextTakeover) {
          params.client_no_context_takeover = true;
        }
        if (this._options.serverMaxWindowBits) {
          params.server_max_window_bits = this._options.serverMaxWindowBits;
        }
        if (this._options.clientMaxWindowBits) {
          params.client_max_window_bits = this._options.clientMaxWindowBits;
        } else if (this._options.clientMaxWindowBits == null) {
          params.client_max_window_bits = true;
        }
        return params;
      }
      /**
       * Accept an extension negotiation offer/response.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Object} Accepted configuration
       * @public
       */
      accept(configurations) {
        configurations = this.normalizeParams(configurations);
        this.params = this._isServer ? this.acceptAsServer(configurations) : this.acceptAsClient(configurations);
        return this.params;
      }
      /**
       * Releases all resources used by the extension.
       *
       * @public
       */
      cleanup() {
        if (this._inflate) {
          this._inflate.close();
          this._inflate = null;
        }
        if (this._deflate) {
          const callback = this._deflate[kCallback];
          this._deflate.close();
          this._deflate = null;
          if (callback) {
            callback(
              new Error(
                "The deflate stream was closed while data was being processed"
              )
            );
          }
        }
      }
      /**
       *  Accept an extension negotiation offer.
       *
       * @param {Array} offers The extension negotiation offers
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsServer(offers) {
        const opts = this._options;
        const accepted = offers.find((params) => {
          if (opts.serverNoContextTakeover === false && params.server_no_context_takeover || params.server_max_window_bits && (opts.serverMaxWindowBits === false || typeof opts.serverMaxWindowBits === "number" && opts.serverMaxWindowBits > params.server_max_window_bits) || typeof opts.clientMaxWindowBits === "number" && !params.client_max_window_bits) {
            return false;
          }
          return true;
        });
        if (!accepted) {
          throw new Error("None of the extension offers can be accepted");
        }
        if (opts.serverNoContextTakeover) {
          accepted.server_no_context_takeover = true;
        }
        if (opts.clientNoContextTakeover) {
          accepted.client_no_context_takeover = true;
        }
        if (typeof opts.serverMaxWindowBits === "number") {
          accepted.server_max_window_bits = opts.serverMaxWindowBits;
        }
        if (typeof opts.clientMaxWindowBits === "number") {
          accepted.client_max_window_bits = opts.clientMaxWindowBits;
        } else if (accepted.client_max_window_bits === true || opts.clientMaxWindowBits === false) {
          delete accepted.client_max_window_bits;
        }
        return accepted;
      }
      /**
       * Accept the extension negotiation response.
       *
       * @param {Array} response The extension negotiation response
       * @return {Object} Accepted configuration
       * @private
       */
      acceptAsClient(response) {
        const params = response[0];
        if (this._options.clientNoContextTakeover === false && params.client_no_context_takeover) {
          throw new Error('Unexpected parameter "client_no_context_takeover"');
        }
        if (!params.client_max_window_bits) {
          if (typeof this._options.clientMaxWindowBits === "number") {
            params.client_max_window_bits = this._options.clientMaxWindowBits;
          }
        } else if (this._options.clientMaxWindowBits === false || typeof this._options.clientMaxWindowBits === "number" && params.client_max_window_bits > this._options.clientMaxWindowBits) {
          throw new Error(
            'Unexpected or invalid parameter "client_max_window_bits"'
          );
        }
        return params;
      }
      /**
       * Normalize parameters.
       *
       * @param {Array} configurations The extension negotiation offers/reponse
       * @return {Array} The offers/response with normalized parameters
       * @private
       */
      normalizeParams(configurations) {
        configurations.forEach((params) => {
          Object.keys(params).forEach((key) => {
            let value = params[key];
            if (value.length > 1) {
              throw new Error(`Parameter "${key}" must have only a single value`);
            }
            value = value[0];
            if (key === "client_max_window_bits") {
              if (value !== true) {
                const num = +value;
                if (!Number.isInteger(num) || num < 8 || num > 15) {
                  throw new TypeError(
                    `Invalid value for parameter "${key}": ${value}`
                  );
                }
                value = num;
              } else if (!this._isServer) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else if (key === "server_max_window_bits") {
              const num = +value;
              if (!Number.isInteger(num) || num < 8 || num > 15) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
              value = num;
            } else if (key === "client_no_context_takeover" || key === "server_no_context_takeover") {
              if (value !== true) {
                throw new TypeError(
                  `Invalid value for parameter "${key}": ${value}`
                );
              }
            } else {
              throw new Error(`Unknown parameter "${key}"`);
            }
            params[key] = value;
          });
        });
        return configurations;
      }
      /**
       * Decompress data. Concurrency limited.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      decompress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._decompress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Compress data. Concurrency limited.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @public
       */
      compress(data, fin, callback) {
        zlibLimiter.add((done) => {
          this._compress(data, fin, (err, result) => {
            done();
            callback(err, result);
          });
        });
      }
      /**
       * Decompress data.
       *
       * @param {Buffer} data Compressed data
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _decompress(data, fin, callback) {
        const endpoint = this._isServer ? "client" : "server";
        if (!this._inflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._inflate = zlib.createInflateRaw({
            ...this._options.zlibInflateOptions,
            windowBits
          });
          this._inflate[kPerMessageDeflate] = this;
          this._inflate[kTotalLength] = 0;
          this._inflate[kBuffers] = [];
          this._inflate.on("error", inflateOnError);
          this._inflate.on("data", inflateOnData);
        }
        this._inflate[kCallback] = callback;
        this._inflate.write(data);
        if (fin) this._inflate.write(TRAILER);
        this._inflate.flush(() => {
          const err = this._inflate[kError];
          if (err) {
            this._inflate.close();
            this._inflate = null;
            callback(err);
            return;
          }
          const data2 = bufferUtil.concat(
            this._inflate[kBuffers],
            this._inflate[kTotalLength]
          );
          if (this._inflate._readableState.endEmitted) {
            this._inflate.close();
            this._inflate = null;
          } else {
            this._inflate[kTotalLength] = 0;
            this._inflate[kBuffers] = [];
            if (fin && this.params[`${endpoint}_no_context_takeover`]) {
              this._inflate.reset();
            }
          }
          callback(null, data2);
        });
      }
      /**
       * Compress data.
       *
       * @param {(Buffer|String)} data Data to compress
       * @param {Boolean} fin Specifies whether or not this is the last fragment
       * @param {Function} callback Callback
       * @private
       */
      _compress(data, fin, callback) {
        const endpoint = this._isServer ? "server" : "client";
        if (!this._deflate) {
          const key = `${endpoint}_max_window_bits`;
          const windowBits = typeof this.params[key] !== "number" ? zlib.Z_DEFAULT_WINDOWBITS : this.params[key];
          this._deflate = zlib.createDeflateRaw({
            ...this._options.zlibDeflateOptions,
            windowBits
          });
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          this._deflate.on("data", deflateOnData);
        }
        this._deflate[kCallback] = callback;
        this._deflate.write(data);
        this._deflate.flush(zlib.Z_SYNC_FLUSH, () => {
          if (!this._deflate) {
            return;
          }
          let data2 = bufferUtil.concat(
            this._deflate[kBuffers],
            this._deflate[kTotalLength]
          );
          if (fin) {
            data2 = new FastBuffer(data2.buffer, data2.byteOffset, data2.length - 4);
          }
          this._deflate[kCallback] = null;
          this._deflate[kTotalLength] = 0;
          this._deflate[kBuffers] = [];
          if (fin && this.params[`${endpoint}_no_context_takeover`]) {
            this._deflate.reset();
          }
          callback(null, data2);
        });
      }
    };
    module.exports = PerMessageDeflate2;
    function deflateOnData(chunk) {
      this[kBuffers].push(chunk);
      this[kTotalLength] += chunk.length;
    }
    function inflateOnData(chunk) {
      this[kTotalLength] += chunk.length;
      if (this[kPerMessageDeflate]._maxPayload < 1 || this[kTotalLength] <= this[kPerMessageDeflate]._maxPayload) {
        this[kBuffers].push(chunk);
        return;
      }
      this[kError] = new RangeError("Max payload size exceeded");
      this[kError].code = "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH";
      this[kError][kStatusCode] = 1009;
      this.removeListener("data", inflateOnData);
      this.reset();
    }
    function inflateOnError(err) {
      this[kPerMessageDeflate]._inflate = null;
      if (this[kError]) {
        this[kCallback](this[kError]);
        return;
      }
      err[kStatusCode] = 1007;
      this[kCallback](err);
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/validation.js
var require_validation = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/validation.js"(exports, module) {
    "use strict";
    var { isUtf8 } = __require("buffer");
    var { hasBlob } = require_constants();
    var tokenChars = [
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 0 - 15
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      0,
      // 16 - 31
      0,
      1,
      0,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      1,
      1,
      0,
      1,
      1,
      0,
      // 32 - 47
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      0,
      0,
      0,
      // 48 - 63
      0,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 64 - 79
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      0,
      0,
      1,
      1,
      // 80 - 95
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      // 96 - 111
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      0,
      1,
      0,
      1,
      0
      // 112 - 127
    ];
    function isValidStatusCode(code) {
      return code >= 1e3 && code <= 1014 && code !== 1004 && code !== 1005 && code !== 1006 || code >= 3e3 && code <= 4999;
    }
    function _isValidUTF8(buf) {
      const len = buf.length;
      let i = 0;
      while (i < len) {
        if ((buf[i] & 128) === 0) {
          i++;
        } else if ((buf[i] & 224) === 192) {
          if (i + 1 === len || (buf[i + 1] & 192) !== 128 || (buf[i] & 254) === 192) {
            return false;
          }
          i += 2;
        } else if ((buf[i] & 240) === 224) {
          if (i + 2 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || buf[i] === 224 && (buf[i + 1] & 224) === 128 || // Overlong
          buf[i] === 237 && (buf[i + 1] & 224) === 160) {
            return false;
          }
          i += 3;
        } else if ((buf[i] & 248) === 240) {
          if (i + 3 >= len || (buf[i + 1] & 192) !== 128 || (buf[i + 2] & 192) !== 128 || (buf[i + 3] & 192) !== 128 || buf[i] === 240 && (buf[i + 1] & 240) === 128 || // Overlong
          buf[i] === 244 && buf[i + 1] > 143 || buf[i] > 244) {
            return false;
          }
          i += 4;
        } else {
          return false;
        }
      }
      return true;
    }
    function isBlob(value) {
      return hasBlob && typeof value === "object" && typeof value.arrayBuffer === "function" && typeof value.type === "string" && typeof value.stream === "function" && (value[Symbol.toStringTag] === "Blob" || value[Symbol.toStringTag] === "File");
    }
    module.exports = {
      isBlob,
      isValidStatusCode,
      isValidUTF8: _isValidUTF8,
      tokenChars
    };
    if (isUtf8) {
      module.exports.isValidUTF8 = function(buf) {
        return buf.length < 24 ? _isValidUTF8(buf) : isUtf8(buf);
      };
    } else if (!process.env.WS_NO_UTF_8_VALIDATE) {
      try {
        const isValidUTF8 = __require("utf-8-validate");
        module.exports.isValidUTF8 = function(buf) {
          return buf.length < 32 ? _isValidUTF8(buf) : isValidUTF8(buf);
        };
      } catch (e) {
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/receiver.js
var require_receiver = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/receiver.js"(exports, module) {
    "use strict";
    var { Writable } = __require("stream");
    var PerMessageDeflate2 = require_permessage_deflate();
    var {
      BINARY_TYPES,
      EMPTY_BUFFER,
      kStatusCode,
      kWebSocket
    } = require_constants();
    var { concat, toArrayBuffer, unmask } = require_buffer_util();
    var { isValidStatusCode, isValidUTF8 } = require_validation();
    var FastBuffer = Buffer[Symbol.species];
    var GET_INFO = 0;
    var GET_PAYLOAD_LENGTH_16 = 1;
    var GET_PAYLOAD_LENGTH_64 = 2;
    var GET_MASK = 3;
    var GET_DATA = 4;
    var INFLATING = 5;
    var DEFER_EVENT = 6;
    var Receiver2 = class extends Writable {
      /**
       * Creates a Receiver instance.
       *
       * @param {Object} [options] Options object
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {String} [options.binaryType=nodebuffer] The type for binary data
       * @param {Object} [options.extensions] An object containing the negotiated
       *     extensions
       * @param {Boolean} [options.isServer=false] Specifies whether to operate in
       *     client or server mode
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message length
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       */
      constructor(options = {}) {
        super();
        this._allowSynchronousEvents = options.allowSynchronousEvents !== void 0 ? options.allowSynchronousEvents : true;
        this._binaryType = options.binaryType || BINARY_TYPES[0];
        this._extensions = options.extensions || {};
        this._isServer = !!options.isServer;
        this._maxBufferedChunks = options.maxBufferedChunks | 0;
        this._maxFragments = options.maxFragments | 0;
        this._maxPayload = options.maxPayload | 0;
        this._skipUTF8Validation = !!options.skipUTF8Validation;
        this[kWebSocket] = void 0;
        this._bufferedBytes = 0;
        this._buffers = [];
        this._compressed = false;
        this._payloadLength = 0;
        this._mask = void 0;
        this._fragmented = 0;
        this._masked = false;
        this._fin = false;
        this._opcode = 0;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragments = [];
        this._errored = false;
        this._loop = false;
        this._state = GET_INFO;
      }
      /**
       * Implements `Writable.prototype._write()`.
       *
       * @param {Buffer} chunk The chunk of data to write
       * @param {String} encoding The character encoding of `chunk`
       * @param {Function} cb Callback
       * @private
       */
      _write(chunk, encoding, cb) {
        if (this._opcode === 8 && this._state == GET_INFO) return cb();
        if (this._maxBufferedChunks > 0 && this._buffers.length >= this._maxBufferedChunks) {
          cb(
            this.createError(
              RangeError,
              "Too many buffered chunks",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            )
          );
          return;
        }
        this._bufferedBytes += chunk.length;
        this._buffers.push(chunk);
        this.startLoop(cb);
      }
      /**
       * Consumes `n` bytes from the buffered data.
       *
       * @param {Number} n The number of bytes to consume
       * @return {Buffer} The consumed bytes
       * @private
       */
      consume(n) {
        this._bufferedBytes -= n;
        if (n === this._buffers[0].length) return this._buffers.shift();
        if (n < this._buffers[0].length) {
          const buf = this._buffers[0];
          this._buffers[0] = new FastBuffer(
            buf.buffer,
            buf.byteOffset + n,
            buf.length - n
          );
          return new FastBuffer(buf.buffer, buf.byteOffset, n);
        }
        const dst = Buffer.allocUnsafe(n);
        do {
          const buf = this._buffers[0];
          const offset = dst.length - n;
          if (n >= buf.length) {
            dst.set(this._buffers.shift(), offset);
          } else {
            dst.set(new Uint8Array(buf.buffer, buf.byteOffset, n), offset);
            this._buffers[0] = new FastBuffer(
              buf.buffer,
              buf.byteOffset + n,
              buf.length - n
            );
          }
          n -= buf.length;
        } while (n > 0);
        return dst;
      }
      /**
       * Starts the parsing loop.
       *
       * @param {Function} cb Callback
       * @private
       */
      startLoop(cb) {
        this._loop = true;
        do {
          switch (this._state) {
            case GET_INFO:
              this.getInfo(cb);
              break;
            case GET_PAYLOAD_LENGTH_16:
              this.getPayloadLength16(cb);
              break;
            case GET_PAYLOAD_LENGTH_64:
              this.getPayloadLength64(cb);
              break;
            case GET_MASK:
              this.getMask();
              break;
            case GET_DATA:
              this.getData(cb);
              break;
            case INFLATING:
            case DEFER_EVENT:
              this._loop = false;
              return;
          }
        } while (this._loop);
        if (!this._errored) cb();
      }
      /**
       * Reads the first two bytes of a frame.
       *
       * @param {Function} cb Callback
       * @private
       */
      getInfo(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        const buf = this.consume(2);
        if ((buf[0] & 48) !== 0) {
          const error = this.createError(
            RangeError,
            "RSV2 and RSV3 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_2_3"
          );
          cb(error);
          return;
        }
        const compressed = (buf[0] & 64) === 64;
        if (compressed && !this._extensions[PerMessageDeflate2.extensionName]) {
          const error = this.createError(
            RangeError,
            "RSV1 must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_RSV_1"
          );
          cb(error);
          return;
        }
        this._fin = (buf[0] & 128) === 128;
        this._opcode = buf[0] & 15;
        this._payloadLength = buf[1] & 127;
        if (this._opcode === 0) {
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (!this._fragmented) {
            const error = this.createError(
              RangeError,
              "invalid opcode 0",
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._opcode = this._fragmented;
        } else if (this._opcode === 1 || this._opcode === 2) {
          if (this._fragmented) {
            const error = this.createError(
              RangeError,
              `invalid opcode ${this._opcode}`,
              true,
              1002,
              "WS_ERR_INVALID_OPCODE"
            );
            cb(error);
            return;
          }
          this._compressed = compressed;
        } else if (this._opcode > 7 && this._opcode < 11) {
          if (!this._fin) {
            const error = this.createError(
              RangeError,
              "FIN must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_FIN"
            );
            cb(error);
            return;
          }
          if (compressed) {
            const error = this.createError(
              RangeError,
              "RSV1 must be clear",
              true,
              1002,
              "WS_ERR_UNEXPECTED_RSV_1"
            );
            cb(error);
            return;
          }
          if (this._payloadLength > 125 || this._opcode === 8 && this._payloadLength === 1) {
            const error = this.createError(
              RangeError,
              `invalid payload length ${this._payloadLength}`,
              true,
              1002,
              "WS_ERR_INVALID_CONTROL_PAYLOAD_LENGTH"
            );
            cb(error);
            return;
          }
        } else {
          const error = this.createError(
            RangeError,
            `invalid opcode ${this._opcode}`,
            true,
            1002,
            "WS_ERR_INVALID_OPCODE"
          );
          cb(error);
          return;
        }
        if (!this._fin && !this._fragmented) this._fragmented = this._opcode;
        this._masked = (buf[1] & 128) === 128;
        if (this._isServer) {
          if (!this._masked) {
            const error = this.createError(
              RangeError,
              "MASK must be set",
              true,
              1002,
              "WS_ERR_EXPECTED_MASK"
            );
            cb(error);
            return;
          }
        } else if (this._masked) {
          const error = this.createError(
            RangeError,
            "MASK must be clear",
            true,
            1002,
            "WS_ERR_UNEXPECTED_MASK"
          );
          cb(error);
          return;
        }
        if (this._payloadLength === 126) this._state = GET_PAYLOAD_LENGTH_16;
        else if (this._payloadLength === 127) this._state = GET_PAYLOAD_LENGTH_64;
        else this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+16).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength16(cb) {
        if (this._bufferedBytes < 2) {
          this._loop = false;
          return;
        }
        this._payloadLength = this.consume(2).readUInt16BE(0);
        this.haveLength(cb);
      }
      /**
       * Gets extended payload length (7+64).
       *
       * @param {Function} cb Callback
       * @private
       */
      getPayloadLength64(cb) {
        if (this._bufferedBytes < 8) {
          this._loop = false;
          return;
        }
        const buf = this.consume(8);
        const num = buf.readUInt32BE(0);
        if (num > Math.pow(2, 53 - 32) - 1) {
          const error = this.createError(
            RangeError,
            "Unsupported WebSocket frame: payload length > 2^53 - 1",
            false,
            1009,
            "WS_ERR_UNSUPPORTED_DATA_PAYLOAD_LENGTH"
          );
          cb(error);
          return;
        }
        this._payloadLength = num * Math.pow(2, 32) + buf.readUInt32BE(4);
        this.haveLength(cb);
      }
      /**
       * Payload length has been read.
       *
       * @param {Function} cb Callback
       * @private
       */
      haveLength(cb) {
        if (this._payloadLength && this._opcode < 8) {
          this._totalPayloadLength += this._payloadLength;
          if (this._totalPayloadLength > this._maxPayload && this._maxPayload > 0) {
            const error = this.createError(
              RangeError,
              "Max payload size exceeded",
              false,
              1009,
              "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
            );
            cb(error);
            return;
          }
        }
        if (this._masked) this._state = GET_MASK;
        else this._state = GET_DATA;
      }
      /**
       * Reads mask bytes.
       *
       * @private
       */
      getMask() {
        if (this._bufferedBytes < 4) {
          this._loop = false;
          return;
        }
        this._mask = this.consume(4);
        this._state = GET_DATA;
      }
      /**
       * Reads data bytes.
       *
       * @param {Function} cb Callback
       * @private
       */
      getData(cb) {
        let data = EMPTY_BUFFER;
        if (this._payloadLength) {
          if (this._bufferedBytes < this._payloadLength) {
            this._loop = false;
            return;
          }
          data = this.consume(this._payloadLength);
          if (this._masked && (this._mask[0] | this._mask[1] | this._mask[2] | this._mask[3]) !== 0) {
            unmask(data, this._mask);
          }
        }
        if (this._opcode > 7) {
          this.controlMessage(data, cb);
          return;
        }
        if (this._compressed) {
          this._state = INFLATING;
          this.decompress(data, cb);
          return;
        }
        if (data.length) {
          if (this._maxFragments > 0 && this._fragments.length >= this._maxFragments) {
            const error = this.createError(
              RangeError,
              "Too many message fragments",
              false,
              1008,
              "WS_ERR_TOO_MANY_BUFFERED_PARTS"
            );
            cb(error);
            return;
          }
          this._messageLength = this._totalPayloadLength;
          this._fragments.push(data);
        }
        this.dataMessage(cb);
      }
      /**
       * Decompresses data.
       *
       * @param {Buffer} data Compressed data
       * @param {Function} cb Callback
       * @private
       */
      decompress(data, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        perMessageDeflate.decompress(data, this._fin, (err, buf) => {
          if (err) return cb(err);
          if (buf.length) {
            this._messageLength += buf.length;
            if (this._messageLength > this._maxPayload && this._maxPayload > 0) {
              const error = this.createError(
                RangeError,
                "Max payload size exceeded",
                false,
                1009,
                "WS_ERR_UNSUPPORTED_MESSAGE_LENGTH"
              );
              cb(error);
              return;
            }
            if (this._maxFragments > 0 && this._fragments.length >= this._maxFragments) {
              const error = this.createError(
                RangeError,
                "Too many message fragments",
                false,
                1008,
                "WS_ERR_TOO_MANY_BUFFERED_PARTS"
              );
              cb(error);
              return;
            }
            this._fragments.push(buf);
          }
          this.dataMessage(cb);
          if (this._state === GET_INFO) this.startLoop(cb);
        });
      }
      /**
       * Handles a data message.
       *
       * @param {Function} cb Callback
       * @private
       */
      dataMessage(cb) {
        if (!this._fin) {
          this._state = GET_INFO;
          return;
        }
        const messageLength = this._messageLength;
        const fragments = this._fragments;
        this._totalPayloadLength = 0;
        this._messageLength = 0;
        this._fragmented = 0;
        this._fragments = [];
        if (this._opcode === 2) {
          let data;
          if (this._binaryType === "nodebuffer") {
            data = concat(fragments, messageLength);
          } else if (this._binaryType === "arraybuffer") {
            data = toArrayBuffer(concat(fragments, messageLength));
          } else if (this._binaryType === "blob") {
            data = new Blob(fragments);
          } else {
            data = fragments;
          }
          if (this._allowSynchronousEvents) {
            this.emit("message", data, true);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", data, true);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        } else {
          const buf = concat(fragments, messageLength);
          if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
            const error = this.createError(
              Error,
              "invalid UTF-8 sequence",
              true,
              1007,
              "WS_ERR_INVALID_UTF8"
            );
            cb(error);
            return;
          }
          if (this._state === INFLATING || this._allowSynchronousEvents) {
            this.emit("message", buf, false);
            this._state = GET_INFO;
          } else {
            this._state = DEFER_EVENT;
            setImmediate(() => {
              this.emit("message", buf, false);
              this._state = GET_INFO;
              this.startLoop(cb);
            });
          }
        }
      }
      /**
       * Handles a control message.
       *
       * @param {Buffer} data Data to handle
       * @return {(Error|RangeError|undefined)} A possible error
       * @private
       */
      controlMessage(data, cb) {
        if (this._opcode === 8) {
          if (data.length === 0) {
            this._loop = false;
            this.emit("conclude", 1005, EMPTY_BUFFER);
            this.end();
          } else {
            const code = data.readUInt16BE(0);
            if (!isValidStatusCode(code)) {
              const error = this.createError(
                RangeError,
                `invalid status code ${code}`,
                true,
                1002,
                "WS_ERR_INVALID_CLOSE_CODE"
              );
              cb(error);
              return;
            }
            const buf = new FastBuffer(
              data.buffer,
              data.byteOffset + 2,
              data.length - 2
            );
            if (!this._skipUTF8Validation && !isValidUTF8(buf)) {
              const error = this.createError(
                Error,
                "invalid UTF-8 sequence",
                true,
                1007,
                "WS_ERR_INVALID_UTF8"
              );
              cb(error);
              return;
            }
            this._loop = false;
            this.emit("conclude", code, buf);
            this.end();
          }
          this._state = GET_INFO;
          return;
        }
        if (this._allowSynchronousEvents) {
          this.emit(this._opcode === 9 ? "ping" : "pong", data);
          this._state = GET_INFO;
        } else {
          this._state = DEFER_EVENT;
          setImmediate(() => {
            this.emit(this._opcode === 9 ? "ping" : "pong", data);
            this._state = GET_INFO;
            this.startLoop(cb);
          });
        }
      }
      /**
       * Builds an error object.
       *
       * @param {function(new:Error|RangeError)} ErrorCtor The error constructor
       * @param {String} message The error message
       * @param {Boolean} prefix Specifies whether or not to add a default prefix to
       *     `message`
       * @param {Number} statusCode The status code
       * @param {String} errorCode The exposed error code
       * @return {(Error|RangeError)} The error
       * @private
       */
      createError(ErrorCtor, message, prefix, statusCode, errorCode) {
        this._loop = false;
        this._errored = true;
        const err = new ErrorCtor(
          prefix ? `Invalid WebSocket frame: ${message}` : message
        );
        Error.captureStackTrace(err, this.createError);
        err.code = errorCode;
        err[kStatusCode] = statusCode;
        return err;
      }
    };
    module.exports = Receiver2;
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/sender.js
var require_sender = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/sender.js"(exports, module) {
    "use strict";
    var { Duplex } = __require("stream");
    var { randomFillSync } = __require("crypto");
    var {
      types: { isUint8Array }
    } = __require("util");
    var PerMessageDeflate2 = require_permessage_deflate();
    var { EMPTY_BUFFER, kWebSocket, NOOP } = require_constants();
    var { isBlob, isValidStatusCode } = require_validation();
    var { mask: applyMask, toBuffer } = require_buffer_util();
    var kByteLength = /* @__PURE__ */ Symbol("kByteLength");
    var maskBuffer = Buffer.alloc(4);
    var RANDOM_POOL_SIZE = 8 * 1024;
    var randomPool;
    var randomPoolPointer = RANDOM_POOL_SIZE;
    var DEFAULT2 = 0;
    var DEFLATING = 1;
    var GET_BLOB_DATA = 2;
    var Sender2 = class _Sender {
      /**
       * Creates a Sender instance.
       *
       * @param {Duplex} socket The connection socket
       * @param {Object} [extensions] An object containing the negotiated extensions
       * @param {Function} [generateMask] The function used to generate the masking
       *     key
       */
      constructor(socket, extensions, generateMask) {
        this._extensions = extensions || {};
        if (generateMask) {
          this._generateMask = generateMask;
          this._maskBuffer = Buffer.alloc(4);
        }
        this._socket = socket;
        this._firstFragment = true;
        this._compress = false;
        this._bufferedBytes = 0;
        this._queue = [];
        this._state = DEFAULT2;
        this.onerror = NOOP;
        this[kWebSocket] = void 0;
      }
      /**
       * Frames a piece of data according to the HyBi WebSocket protocol.
       *
       * @param {(Buffer|String)} data The data to frame
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @return {(Buffer|String)[]} The framed data
       * @public
       */
      static frame(data, options) {
        let mask;
        let merge = false;
        let offset = 2;
        let skipMasking = false;
        if (options.mask) {
          mask = options.maskBuffer || maskBuffer;
          if (options.generateMask) {
            options.generateMask(mask);
          } else {
            if (randomPoolPointer === RANDOM_POOL_SIZE) {
              if (randomPool === void 0) {
                randomPool = Buffer.alloc(RANDOM_POOL_SIZE);
              }
              randomFillSync(randomPool, 0, RANDOM_POOL_SIZE);
              randomPoolPointer = 0;
            }
            mask[0] = randomPool[randomPoolPointer++];
            mask[1] = randomPool[randomPoolPointer++];
            mask[2] = randomPool[randomPoolPointer++];
            mask[3] = randomPool[randomPoolPointer++];
          }
          skipMasking = (mask[0] | mask[1] | mask[2] | mask[3]) === 0;
          offset = 6;
        }
        let dataLength;
        if (typeof data === "string") {
          if ((!options.mask || skipMasking) && options[kByteLength] !== void 0) {
            dataLength = options[kByteLength];
          } else {
            data = Buffer.from(data);
            dataLength = data.length;
          }
        } else {
          dataLength = data.length;
          merge = options.mask && options.readOnly && !skipMasking;
        }
        let payloadLength = dataLength;
        if (dataLength >= 65536) {
          offset += 8;
          payloadLength = 127;
        } else if (dataLength > 125) {
          offset += 2;
          payloadLength = 126;
        }
        const target = Buffer.allocUnsafe(merge ? dataLength + offset : offset);
        target[0] = options.fin ? options.opcode | 128 : options.opcode;
        if (options.rsv1) target[0] |= 64;
        target[1] = payloadLength;
        if (payloadLength === 126) {
          target.writeUInt16BE(dataLength, 2);
        } else if (payloadLength === 127) {
          target[2] = target[3] = 0;
          target.writeUIntBE(dataLength, 4, 6);
        }
        if (!options.mask) return [target, data];
        target[1] |= 128;
        target[offset - 4] = mask[0];
        target[offset - 3] = mask[1];
        target[offset - 2] = mask[2];
        target[offset - 1] = mask[3];
        if (skipMasking) return [target, data];
        if (merge) {
          applyMask(data, mask, target, offset, dataLength);
          return [target];
        }
        applyMask(data, mask, data, 0, dataLength);
        return [target, data];
      }
      /**
       * Sends a close message to the other peer.
       *
       * @param {Number} [code] The status code component of the body
       * @param {(String|Buffer)} [data] The message component of the body
       * @param {Boolean} [mask=false] Specifies whether or not to mask the message
       * @param {Function} [cb] Callback
       * @public
       */
      close(code, data, mask, cb) {
        let buf;
        if (code === void 0) {
          buf = EMPTY_BUFFER;
        } else if (typeof code !== "number" || !isValidStatusCode(code)) {
          throw new TypeError("First argument must be a valid error code number");
        } else if (data === void 0 || !data.length) {
          buf = Buffer.allocUnsafe(2);
          buf.writeUInt16BE(code, 0);
        } else {
          const length = Buffer.byteLength(data);
          if (length > 123) {
            throw new RangeError("The message must not be greater than 123 bytes");
          }
          buf = Buffer.allocUnsafe(2 + length);
          buf.writeUInt16BE(code, 0);
          if (typeof data === "string") {
            buf.write(data, 2);
          } else if (isUint8Array(data)) {
            buf.set(data, 2);
          } else {
            throw new TypeError("Second argument must be a string or a Uint8Array");
          }
        }
        const options = {
          [kByteLength]: buf.length,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 8,
          readOnly: false,
          rsv1: false
        };
        if (this._state !== DEFAULT2) {
          this.enqueue([this.dispatch, buf, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(buf, options), cb);
        }
      }
      /**
       * Sends a ping message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      ping(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 9,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT2) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT2) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a pong message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Boolean} [mask=false] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback
       * @public
       */
      pong(data, mask, cb) {
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (byteLength > 125) {
          throw new RangeError("The data size must not be greater than 125 bytes");
        }
        const options = {
          [kByteLength]: byteLength,
          fin: true,
          generateMask: this._generateMask,
          mask,
          maskBuffer: this._maskBuffer,
          opcode: 10,
          readOnly,
          rsv1: false
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT2) {
            this.enqueue([this.getBlobData, data, false, options, cb]);
          } else {
            this.getBlobData(data, false, options, cb);
          }
        } else if (this._state !== DEFAULT2) {
          this.enqueue([this.dispatch, data, false, options, cb]);
        } else {
          this.sendFrame(_Sender.frame(data, options), cb);
        }
      }
      /**
       * Sends a data message to the other peer.
       *
       * @param {*} data The message to send
       * @param {Object} options Options object
       * @param {Boolean} [options.binary=false] Specifies whether `data` is binary
       *     or text
       * @param {Boolean} [options.compress=false] Specifies whether or not to
       *     compress `data`
       * @param {Boolean} [options.fin=false] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Function} [cb] Callback
       * @public
       */
      send(data, options, cb) {
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        let opcode = options.binary ? 2 : 1;
        let rsv1 = options.compress;
        let byteLength;
        let readOnly;
        if (typeof data === "string") {
          byteLength = Buffer.byteLength(data);
          readOnly = false;
        } else if (isBlob(data)) {
          byteLength = data.size;
          readOnly = false;
        } else {
          data = toBuffer(data);
          byteLength = data.length;
          readOnly = toBuffer.readOnly;
        }
        if (this._firstFragment) {
          this._firstFragment = false;
          if (rsv1 && perMessageDeflate && perMessageDeflate.params[perMessageDeflate._isServer ? "server_no_context_takeover" : "client_no_context_takeover"]) {
            rsv1 = byteLength >= perMessageDeflate._threshold;
          }
          this._compress = rsv1;
        } else {
          rsv1 = false;
          opcode = 0;
        }
        if (options.fin) this._firstFragment = true;
        const opts = {
          [kByteLength]: byteLength,
          fin: options.fin,
          generateMask: this._generateMask,
          mask: options.mask,
          maskBuffer: this._maskBuffer,
          opcode,
          readOnly,
          rsv1
        };
        if (isBlob(data)) {
          if (this._state !== DEFAULT2) {
            this.enqueue([this.getBlobData, data, this._compress, opts, cb]);
          } else {
            this.getBlobData(data, this._compress, opts, cb);
          }
        } else if (this._state !== DEFAULT2) {
          this.enqueue([this.dispatch, data, this._compress, opts, cb]);
        } else {
          this.dispatch(data, this._compress, opts, cb);
        }
      }
      /**
       * Gets the contents of a blob as binary data.
       *
       * @param {Blob} blob The blob
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     the data
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      getBlobData(blob, compress, options, cb) {
        this._bufferedBytes += options[kByteLength];
        this._state = GET_BLOB_DATA;
        blob.arrayBuffer().then((arrayBuffer) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while the blob was being read"
            );
            process.nextTick(callCallbacks, this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          const data = toBuffer(arrayBuffer);
          if (!compress) {
            this._state = DEFAULT2;
            this.sendFrame(_Sender.frame(data, options), cb);
            this.dequeue();
          } else {
            this.dispatch(data, compress, options, cb);
          }
        }).catch((err) => {
          process.nextTick(onError, this, err, cb);
        });
      }
      /**
       * Dispatches a message.
       *
       * @param {(Buffer|String)} data The message to send
       * @param {Boolean} [compress=false] Specifies whether or not to compress
       *     `data`
       * @param {Object} options Options object
       * @param {Boolean} [options.fin=false] Specifies whether or not to set the
       *     FIN bit
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Boolean} [options.mask=false] Specifies whether or not to mask
       *     `data`
       * @param {Buffer} [options.maskBuffer] The buffer used to store the masking
       *     key
       * @param {Number} options.opcode The opcode
       * @param {Boolean} [options.readOnly=false] Specifies whether `data` can be
       *     modified
       * @param {Boolean} [options.rsv1=false] Specifies whether or not to set the
       *     RSV1 bit
       * @param {Function} [cb] Callback
       * @private
       */
      dispatch(data, compress, options, cb) {
        if (!compress) {
          this.sendFrame(_Sender.frame(data, options), cb);
          return;
        }
        const perMessageDeflate = this._extensions[PerMessageDeflate2.extensionName];
        this._bufferedBytes += options[kByteLength];
        this._state = DEFLATING;
        perMessageDeflate.compress(data, options.fin, (_, buf) => {
          if (this._socket.destroyed) {
            const err = new Error(
              "The socket was closed while data was being compressed"
            );
            callCallbacks(this, err, cb);
            return;
          }
          this._bufferedBytes -= options[kByteLength];
          this._state = DEFAULT2;
          options.readOnly = false;
          this.sendFrame(_Sender.frame(buf, options), cb);
          this.dequeue();
        });
      }
      /**
       * Executes queued send operations.
       *
       * @private
       */
      dequeue() {
        while (this._state === DEFAULT2 && this._queue.length) {
          const params = this._queue.shift();
          this._bufferedBytes -= params[3][kByteLength];
          Reflect.apply(params[0], this, params.slice(1));
        }
      }
      /**
       * Enqueues a send operation.
       *
       * @param {Array} params Send operation parameters.
       * @private
       */
      enqueue(params) {
        this._bufferedBytes += params[3][kByteLength];
        this._queue.push(params);
      }
      /**
       * Sends a frame.
       *
       * @param {(Buffer | String)[]} list The frame to send
       * @param {Function} [cb] Callback
       * @private
       */
      sendFrame(list, cb) {
        if (list.length === 2) {
          this._socket.cork();
          this._socket.write(list[0]);
          this._socket.write(list[1], cb);
          this._socket.uncork();
        } else {
          this._socket.write(list[0], cb);
        }
      }
    };
    module.exports = Sender2;
    function callCallbacks(sender, err, cb) {
      if (typeof cb === "function") cb(err);
      for (let i = 0; i < sender._queue.length; i++) {
        const params = sender._queue[i];
        const callback = params[params.length - 1];
        if (typeof callback === "function") callback(err);
      }
    }
    function onError(sender, err, cb) {
      callCallbacks(sender, err, cb);
      sender.onerror(err);
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/event-target.js
var require_event_target = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/event-target.js"(exports, module) {
    "use strict";
    var { kForOnEventAttribute, kListener } = require_constants();
    var kCode = /* @__PURE__ */ Symbol("kCode");
    var kData = /* @__PURE__ */ Symbol("kData");
    var kError = /* @__PURE__ */ Symbol("kError");
    var kMessage = /* @__PURE__ */ Symbol("kMessage");
    var kReason = /* @__PURE__ */ Symbol("kReason");
    var kTarget = /* @__PURE__ */ Symbol("kTarget");
    var kType = /* @__PURE__ */ Symbol("kType");
    var kWasClean = /* @__PURE__ */ Symbol("kWasClean");
    var Event = class {
      /**
       * Create a new `Event`.
       *
       * @param {String} type The name of the event
       * @throws {TypeError} If the `type` argument is not specified
       */
      constructor(type) {
        this[kTarget] = null;
        this[kType] = type;
      }
      /**
       * @type {*}
       */
      get target() {
        return this[kTarget];
      }
      /**
       * @type {String}
       */
      get type() {
        return this[kType];
      }
    };
    Object.defineProperty(Event.prototype, "target", { enumerable: true });
    Object.defineProperty(Event.prototype, "type", { enumerable: true });
    var CloseEvent = class extends Event {
      /**
       * Create a new `CloseEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {Number} [options.code=0] The status code explaining why the
       *     connection was closed
       * @param {String} [options.reason=''] A human-readable string explaining why
       *     the connection was closed
       * @param {Boolean} [options.wasClean=false] Indicates whether or not the
       *     connection was cleanly closed
       */
      constructor(type, options = {}) {
        super(type);
        this[kCode] = options.code === void 0 ? 0 : options.code;
        this[kReason] = options.reason === void 0 ? "" : options.reason;
        this[kWasClean] = options.wasClean === void 0 ? false : options.wasClean;
      }
      /**
       * @type {Number}
       */
      get code() {
        return this[kCode];
      }
      /**
       * @type {String}
       */
      get reason() {
        return this[kReason];
      }
      /**
       * @type {Boolean}
       */
      get wasClean() {
        return this[kWasClean];
      }
    };
    Object.defineProperty(CloseEvent.prototype, "code", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "reason", { enumerable: true });
    Object.defineProperty(CloseEvent.prototype, "wasClean", { enumerable: true });
    var ErrorEvent = class extends Event {
      /**
       * Create a new `ErrorEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.error=null] The error that generated this event
       * @param {String} [options.message=''] The error message
       */
      constructor(type, options = {}) {
        super(type);
        this[kError] = options.error === void 0 ? null : options.error;
        this[kMessage] = options.message === void 0 ? "" : options.message;
      }
      /**
       * @type {*}
       */
      get error() {
        return this[kError];
      }
      /**
       * @type {String}
       */
      get message() {
        return this[kMessage];
      }
    };
    Object.defineProperty(ErrorEvent.prototype, "error", { enumerable: true });
    Object.defineProperty(ErrorEvent.prototype, "message", { enumerable: true });
    var MessageEvent = class extends Event {
      /**
       * Create a new `MessageEvent`.
       *
       * @param {String} type The name of the event
       * @param {Object} [options] A dictionary object that allows for setting
       *     attributes via object members of the same name
       * @param {*} [options.data=null] The message content
       */
      constructor(type, options = {}) {
        super(type);
        this[kData] = options.data === void 0 ? null : options.data;
      }
      /**
       * @type {*}
       */
      get data() {
        return this[kData];
      }
    };
    Object.defineProperty(MessageEvent.prototype, "data", { enumerable: true });
    var EventTarget = {
      /**
       * Register an event listener.
       *
       * @param {String} type A string representing the event type to listen for
       * @param {(Function|Object)} handler The listener to add
       * @param {Object} [options] An options object specifies characteristics about
       *     the event listener
       * @param {Boolean} [options.once=false] A `Boolean` indicating that the
       *     listener should be invoked at most once after being added. If `true`,
       *     the listener would be automatically removed when invoked.
       * @public
       */
      addEventListener(type, handler, options = {}) {
        for (const listener of this.listeners(type)) {
          if (!options[kForOnEventAttribute] && listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            return;
          }
        }
        let wrapper;
        if (type === "message") {
          wrapper = function onMessage(data, isBinary) {
            const event = new MessageEvent("message", {
              data: isBinary ? data : data.toString()
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "close") {
          wrapper = function onClose(code, message) {
            const event = new CloseEvent("close", {
              code,
              reason: message.toString(),
              wasClean: this._closeFrameReceived && this._closeFrameSent
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "error") {
          wrapper = function onError(error) {
            const event = new ErrorEvent("error", {
              error,
              message: error.message
            });
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else if (type === "open") {
          wrapper = function onOpen() {
            const event = new Event("open");
            event[kTarget] = this;
            callListener(handler, this, event);
          };
        } else {
          return;
        }
        wrapper[kForOnEventAttribute] = !!options[kForOnEventAttribute];
        wrapper[kListener] = handler;
        if (options.once) {
          this.once(type, wrapper);
        } else {
          this.on(type, wrapper);
        }
      },
      /**
       * Remove an event listener.
       *
       * @param {String} type A string representing the event type to remove
       * @param {(Function|Object)} handler The listener to remove
       * @public
       */
      removeEventListener(type, handler) {
        for (const listener of this.listeners(type)) {
          if (listener[kListener] === handler && !listener[kForOnEventAttribute]) {
            this.removeListener(type, listener);
            break;
          }
        }
      }
    };
    module.exports = {
      CloseEvent,
      ErrorEvent,
      Event,
      EventTarget,
      MessageEvent
    };
    function callListener(listener, thisArg, event) {
      if (typeof listener === "object" && listener.handleEvent) {
        listener.handleEvent.call(listener, event);
      } else {
        listener.call(thisArg, event);
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/extension.js
var require_extension = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/extension.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function push(dest, name, elem) {
      if (dest[name] === void 0) dest[name] = [elem];
      else dest[name].push(elem);
    }
    function parse(header) {
      const offers = /* @__PURE__ */ Object.create(null);
      let params = /* @__PURE__ */ Object.create(null);
      let mustUnescape = false;
      let isEscaping = false;
      let inQuotes = false;
      let extensionName;
      let paramName;
      let start = -1;
      let code = -1;
      let end = -1;
      let i = 0;
      for (; i < header.length; i++) {
        code = header.charCodeAt(i);
        if (extensionName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (i !== 0 && (code === 32 || code === 9)) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            const name = header.slice(start, end);
            if (code === 44) {
              push(offers, name, params);
              params = /* @__PURE__ */ Object.create(null);
            } else {
              extensionName = name;
            }
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else if (paramName === void 0) {
          if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (code === 32 || code === 9) {
            if (end === -1 && start !== -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            push(params, header.slice(start, end), true);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            start = end = -1;
          } else if (code === 61 && start !== -1 && end === -1) {
            paramName = header.slice(start, i);
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        } else {
          if (isEscaping) {
            if (tokenChars[code] !== 1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (start === -1) start = i;
            else if (!mustUnescape) mustUnescape = true;
            isEscaping = false;
          } else if (inQuotes) {
            if (tokenChars[code] === 1) {
              if (start === -1) start = i;
            } else if (code === 34 && start !== -1) {
              inQuotes = false;
              end = i;
            } else if (code === 92) {
              isEscaping = true;
            } else {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
          } else if (code === 34 && header.charCodeAt(i - 1) === 61) {
            inQuotes = true;
          } else if (end === -1 && tokenChars[code] === 1) {
            if (start === -1) start = i;
          } else if (start !== -1 && (code === 32 || code === 9)) {
            if (end === -1) end = i;
          } else if (code === 59 || code === 44) {
            if (start === -1) {
              throw new SyntaxError(`Unexpected character at index ${i}`);
            }
            if (end === -1) end = i;
            let value = header.slice(start, end);
            if (mustUnescape) {
              value = value.replace(/\\/g, "");
              mustUnescape = false;
            }
            push(params, paramName, value);
            if (code === 44) {
              push(offers, extensionName, params);
              params = /* @__PURE__ */ Object.create(null);
              extensionName = void 0;
            }
            paramName = void 0;
            start = end = -1;
          } else {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
        }
      }
      if (start === -1 || inQuotes || code === 32 || code === 9) {
        throw new SyntaxError("Unexpected end of input");
      }
      if (end === -1) end = i;
      const token = header.slice(start, end);
      if (extensionName === void 0) {
        push(offers, token, params);
      } else {
        if (paramName === void 0) {
          push(params, token, true);
        } else if (mustUnescape) {
          push(params, paramName, token.replace(/\\/g, ""));
        } else {
          push(params, paramName, token);
        }
        push(offers, extensionName, params);
      }
      return offers;
    }
    function format(extensions) {
      return Object.keys(extensions).map((extension2) => {
        let configurations = extensions[extension2];
        if (!Array.isArray(configurations)) configurations = [configurations];
        return configurations.map((params) => {
          return [extension2].concat(
            Object.keys(params).map((k) => {
              let values = params[k];
              if (!Array.isArray(values)) values = [values];
              return values.map((v) => v === true ? k : `${k}=${v}`).join("; ");
            })
          ).join("; ");
        }).join(", ");
      }).join(", ");
    }
    module.exports = { format, parse };
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket.js
var require_websocket = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket.js"(exports, module) {
    "use strict";
    var EventEmitter3 = __require("events");
    var https = __require("https");
    var http2 = __require("http");
    var net = __require("net");
    var tls = __require("tls");
    var { randomBytes, createHash: createHash4 } = __require("crypto");
    var { Duplex, Readable: Readable2 } = __require("stream");
    var { URL: URL3 } = __require("url");
    var PerMessageDeflate2 = require_permessage_deflate();
    var Receiver2 = require_receiver();
    var Sender2 = require_sender();
    var { isBlob } = require_validation();
    var {
      BINARY_TYPES,
      CLOSE_TIMEOUT,
      EMPTY_BUFFER,
      GUID,
      kForOnEventAttribute,
      kListener,
      kStatusCode,
      kWebSocket,
      NOOP
    } = require_constants();
    var {
      EventTarget: { addEventListener, removeEventListener }
    } = require_event_target();
    var { format, parse } = require_extension();
    var { toBuffer } = require_buffer_util();
    var kAborted = /* @__PURE__ */ Symbol("kAborted");
    var protocolVersions = [8, 13];
    var readyStates = ["CONNECTING", "OPEN", "CLOSING", "CLOSED"];
    var subprotocolRegex = /^[!#$%&'*+\-.0-9A-Z^_`|a-z~]+$/;
    var WebSocket2 = class _WebSocket extends EventEmitter3 {
      /**
       * Create a new `WebSocket`.
       *
       * @param {(String|URL)} address The URL to which to connect
       * @param {(String|String[])} [protocols] The subprotocols
       * @param {Object} [options] Connection options
       */
      constructor(address, protocols, options) {
        super();
        this._binaryType = BINARY_TYPES[0];
        this._closeCode = 1006;
        this._closeFrameReceived = false;
        this._closeFrameSent = false;
        this._closeMessage = EMPTY_BUFFER;
        this._closeTimer = null;
        this._errorEmitted = false;
        this._extensions = {};
        this._paused = false;
        this._protocol = "";
        this._readyState = _WebSocket.CONNECTING;
        this._receiver = null;
        this._sender = null;
        this._socket = null;
        if (address !== null) {
          this._bufferedAmount = 0;
          this._isServer = false;
          this._redirects = 0;
          if (protocols === void 0) {
            protocols = [];
          } else if (!Array.isArray(protocols)) {
            if (typeof protocols === "object" && protocols !== null) {
              options = protocols;
              protocols = [];
            } else {
              protocols = [protocols];
            }
          }
          initAsClient(this, address, protocols, options);
        } else {
          this._autoPong = options.autoPong;
          this._closeTimeout = options.closeTimeout;
          this._isServer = true;
        }
      }
      /**
       * For historical reasons, the custom "nodebuffer" type is used by the default
       * instead of "blob".
       *
       * @type {String}
       */
      get binaryType() {
        return this._binaryType;
      }
      set binaryType(type) {
        if (!BINARY_TYPES.includes(type)) return;
        this._binaryType = type;
        if (this._receiver) this._receiver._binaryType = type;
      }
      /**
       * @type {Number}
       */
      get bufferedAmount() {
        if (!this._socket) return this._bufferedAmount;
        return this._socket._writableState.length + this._sender._bufferedBytes;
      }
      /**
       * @type {String}
       */
      get extensions() {
        return Object.keys(this._extensions).join();
      }
      /**
       * @type {Boolean}
       */
      get isPaused() {
        return this._paused;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onclose() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onerror() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onopen() {
        return null;
      }
      /**
       * @type {Function}
       */
      /* istanbul ignore next */
      get onmessage() {
        return null;
      }
      /**
       * @type {String}
       */
      get protocol() {
        return this._protocol;
      }
      /**
       * @type {Number}
       */
      get readyState() {
        return this._readyState;
      }
      /**
       * @type {String}
       */
      get url() {
        return this._url;
      }
      /**
       * Set up the socket and the internal resources.
       *
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Object} options Options object
       * @param {Boolean} [options.allowSynchronousEvents=false] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Function} [options.generateMask] The function used to generate the
       *     masking key
       * @param {Number} [options.maxBufferedChunks=0] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=0] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=0] The maximum allowed message size
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @private
       */
      setSocket(socket, head, options) {
        const receiver = new Receiver2({
          allowSynchronousEvents: options.allowSynchronousEvents,
          binaryType: this.binaryType,
          extensions: this._extensions,
          isServer: this._isServer,
          maxBufferedChunks: options.maxBufferedChunks,
          maxFragments: options.maxFragments,
          maxPayload: options.maxPayload,
          skipUTF8Validation: options.skipUTF8Validation
        });
        const sender = new Sender2(socket, this._extensions, options.generateMask);
        this._receiver = receiver;
        this._sender = sender;
        this._socket = socket;
        receiver[kWebSocket] = this;
        sender[kWebSocket] = this;
        socket[kWebSocket] = this;
        receiver.on("conclude", receiverOnConclude);
        receiver.on("drain", receiverOnDrain);
        receiver.on("error", receiverOnError);
        receiver.on("message", receiverOnMessage);
        receiver.on("ping", receiverOnPing);
        receiver.on("pong", receiverOnPong);
        sender.onerror = senderOnError;
        if (socket.setTimeout) socket.setTimeout(0);
        if (socket.setNoDelay) socket.setNoDelay();
        if (head.length > 0) socket.unshift(head);
        socket.on("close", socketOnClose);
        socket.on("data", socketOnData);
        socket.on("end", socketOnEnd);
        socket.on("error", socketOnError);
        this._readyState = _WebSocket.OPEN;
        this.emit("open");
      }
      /**
       * Emit the `'close'` event.
       *
       * @private
       */
      emitClose() {
        if (!this._socket) {
          this._readyState = _WebSocket.CLOSED;
          this.emit("close", this._closeCode, this._closeMessage);
          return;
        }
        if (this._extensions[PerMessageDeflate2.extensionName]) {
          this._extensions[PerMessageDeflate2.extensionName].cleanup();
        }
        this._receiver.removeAllListeners();
        this._readyState = _WebSocket.CLOSED;
        this.emit("close", this._closeCode, this._closeMessage);
      }
      /**
       * Start a closing handshake.
       *
       *          +----------+   +-----------+   +----------+
       *     - - -|ws.close()|-->|close frame|-->|ws.close()|- - -
       *    |     +----------+   +-----------+   +----------+     |
       *          +----------+   +-----------+         |
       * CLOSING  |ws.close()|<--|close frame|<--+-----+       CLOSING
       *          +----------+   +-----------+   |
       *    |           |                        |   +---+        |
       *                +------------------------+-->|fin| - - - -
       *    |         +---+                      |   +---+
       *     - - - - -|fin|<---------------------+
       *              +---+
       *
       * @param {Number} [code] Status code explaining why the connection is closing
       * @param {(String|Buffer)} [data] The reason why the connection is
       *     closing
       * @public
       */
      close(code, data) {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this.readyState === _WebSocket.CLOSING) {
          if (this._closeFrameSent && (this._closeFrameReceived || this._receiver._writableState.errorEmitted)) {
            this._socket.end();
          }
          return;
        }
        this._readyState = _WebSocket.CLOSING;
        this._sender.close(code, data, !this._isServer, (err) => {
          if (err) return;
          this._closeFrameSent = true;
          if (this._closeFrameReceived || this._receiver._writableState.errorEmitted) {
            this._socket.end();
          }
        });
        setCloseTimer(this);
      }
      /**
       * Pause the socket.
       *
       * @public
       */
      pause() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = true;
        this._socket.pause();
      }
      /**
       * Send a ping.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the ping is sent
       * @public
       */
      ping(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.ping(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Send a pong.
       *
       * @param {*} [data] The data to send
       * @param {Boolean} [mask] Indicates whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when the pong is sent
       * @public
       */
      pong(data, mask, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof data === "function") {
          cb = data;
          data = mask = void 0;
        } else if (typeof mask === "function") {
          cb = mask;
          mask = void 0;
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        if (mask === void 0) mask = !this._isServer;
        this._sender.pong(data || EMPTY_BUFFER, mask, cb);
      }
      /**
       * Resume the socket.
       *
       * @public
       */
      resume() {
        if (this.readyState === _WebSocket.CONNECTING || this.readyState === _WebSocket.CLOSED) {
          return;
        }
        this._paused = false;
        if (!this._receiver._writableState.needDrain) this._socket.resume();
      }
      /**
       * Send a data message.
       *
       * @param {*} data The message to send
       * @param {Object} [options] Options object
       * @param {Boolean} [options.binary] Specifies whether `data` is binary or
       *     text
       * @param {Boolean} [options.compress] Specifies whether or not to compress
       *     `data`
       * @param {Boolean} [options.fin=true] Specifies whether the fragment is the
       *     last one
       * @param {Boolean} [options.mask] Specifies whether or not to mask `data`
       * @param {Function} [cb] Callback which is executed when data is written out
       * @public
       */
      send(data, options, cb) {
        if (this.readyState === _WebSocket.CONNECTING) {
          throw new Error("WebSocket is not open: readyState 0 (CONNECTING)");
        }
        if (typeof options === "function") {
          cb = options;
          options = {};
        }
        if (typeof data === "number") data = data.toString();
        if (this.readyState !== _WebSocket.OPEN) {
          sendAfterClose(this, data, cb);
          return;
        }
        const opts = {
          binary: typeof data !== "string",
          mask: !this._isServer,
          compress: true,
          fin: true,
          ...options
        };
        if (!this._extensions[PerMessageDeflate2.extensionName]) {
          opts.compress = false;
        }
        this._sender.send(data || EMPTY_BUFFER, opts, cb);
      }
      /**
       * Forcibly close the connection.
       *
       * @public
       */
      terminate() {
        if (this.readyState === _WebSocket.CLOSED) return;
        if (this.readyState === _WebSocket.CONNECTING) {
          const msg = "WebSocket was closed before the connection was established";
          abortHandshake(this, this._req, msg);
          return;
        }
        if (this._socket) {
          this._readyState = _WebSocket.CLOSING;
          this._socket.destroy();
        }
      }
    };
    Object.defineProperty(WebSocket2, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2.prototype, "CONNECTING", {
      enumerable: true,
      value: readyStates.indexOf("CONNECTING")
    });
    Object.defineProperty(WebSocket2, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2.prototype, "OPEN", {
      enumerable: true,
      value: readyStates.indexOf("OPEN")
    });
    Object.defineProperty(WebSocket2, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSING", {
      enumerable: true,
      value: readyStates.indexOf("CLOSING")
    });
    Object.defineProperty(WebSocket2, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    Object.defineProperty(WebSocket2.prototype, "CLOSED", {
      enumerable: true,
      value: readyStates.indexOf("CLOSED")
    });
    [
      "binaryType",
      "bufferedAmount",
      "extensions",
      "isPaused",
      "protocol",
      "readyState",
      "url"
    ].forEach((property) => {
      Object.defineProperty(WebSocket2.prototype, property, { enumerable: true });
    });
    ["open", "error", "close", "message"].forEach((method) => {
      Object.defineProperty(WebSocket2.prototype, `on${method}`, {
        enumerable: true,
        get() {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) return listener[kListener];
          }
          return null;
        },
        set(handler) {
          for (const listener of this.listeners(method)) {
            if (listener[kForOnEventAttribute]) {
              this.removeListener(method, listener);
              break;
            }
          }
          if (typeof handler !== "function") return;
          this.addEventListener(method, handler, {
            [kForOnEventAttribute]: true
          });
        }
      });
    });
    WebSocket2.prototype.addEventListener = addEventListener;
    WebSocket2.prototype.removeEventListener = removeEventListener;
    module.exports = WebSocket2;
    function initAsClient(websocket, address, protocols, options) {
      const opts = {
        allowSynchronousEvents: true,
        autoPong: true,
        closeTimeout: CLOSE_TIMEOUT,
        protocolVersion: protocolVersions[1],
        maxBufferedChunks: 1024 * 1024,
        maxFragments: 128 * 1024,
        maxPayload: 100 * 1024 * 1024,
        skipUTF8Validation: false,
        perMessageDeflate: true,
        followRedirects: false,
        maxRedirects: 10,
        ...options,
        socketPath: void 0,
        hostname: void 0,
        protocol: void 0,
        timeout: void 0,
        method: "GET",
        host: void 0,
        path: void 0,
        port: void 0
      };
      websocket._autoPong = opts.autoPong;
      websocket._closeTimeout = opts.closeTimeout;
      if (!protocolVersions.includes(opts.protocolVersion)) {
        throw new RangeError(
          `Unsupported protocol version: ${opts.protocolVersion} (supported versions: ${protocolVersions.join(", ")})`
        );
      }
      let parsedUrl;
      if (address instanceof URL3) {
        parsedUrl = address;
      } else {
        try {
          parsedUrl = new URL3(address);
        } catch {
          throw new SyntaxError(`Invalid URL: ${address}`);
        }
      }
      if (parsedUrl.protocol === "http:") {
        parsedUrl.protocol = "ws:";
      } else if (parsedUrl.protocol === "https:") {
        parsedUrl.protocol = "wss:";
      }
      websocket._url = parsedUrl.href;
      const isSecure = parsedUrl.protocol === "wss:";
      const isIpcUrl = parsedUrl.protocol === "ws+unix:";
      let invalidUrlMessage;
      if (parsedUrl.protocol !== "ws:" && !isSecure && !isIpcUrl) {
        invalidUrlMessage = `The URL's protocol must be one of "ws:", "wss:", "http:", "https:", or "ws+unix:"`;
      } else if (isIpcUrl && !parsedUrl.pathname) {
        invalidUrlMessage = "The URL's pathname is empty";
      } else if (parsedUrl.hash) {
        invalidUrlMessage = "The URL contains a fragment identifier";
      }
      if (invalidUrlMessage) {
        const err = new SyntaxError(invalidUrlMessage);
        if (websocket._redirects === 0) {
          throw err;
        } else {
          emitErrorAndClose(websocket, err);
          return;
        }
      }
      const defaultPort = isSecure ? 443 : 80;
      const key = randomBytes(16).toString("base64");
      const request = isSecure ? https.request : http2.request;
      const protocolSet = /* @__PURE__ */ new Set();
      let perMessageDeflate;
      opts.createConnection = opts.createConnection || (isSecure ? tlsConnect : netConnect);
      opts.defaultPort = opts.defaultPort || defaultPort;
      opts.port = parsedUrl.port || defaultPort;
      opts.host = parsedUrl.hostname.startsWith("[") ? parsedUrl.hostname.slice(1, -1) : parsedUrl.hostname;
      opts.headers = {
        ...opts.headers,
        "Sec-WebSocket-Version": opts.protocolVersion,
        "Sec-WebSocket-Key": key,
        Connection: "Upgrade",
        Upgrade: "websocket"
      };
      opts.path = parsedUrl.pathname + parsedUrl.search;
      opts.timeout = opts.handshakeTimeout;
      if (opts.perMessageDeflate) {
        perMessageDeflate = new PerMessageDeflate2({
          ...opts.perMessageDeflate,
          isServer: false,
          maxPayload: opts.maxPayload
        });
        opts.headers["Sec-WebSocket-Extensions"] = format({
          [PerMessageDeflate2.extensionName]: perMessageDeflate.offer()
        });
      }
      if (protocols.length) {
        for (const protocol of protocols) {
          if (typeof protocol !== "string" || !subprotocolRegex.test(protocol) || protocolSet.has(protocol)) {
            throw new SyntaxError(
              "An invalid or duplicated subprotocol was specified"
            );
          }
          protocolSet.add(protocol);
        }
        opts.headers["Sec-WebSocket-Protocol"] = protocols.join(",");
      }
      if (opts.origin) {
        if (opts.protocolVersion < 13) {
          opts.headers["Sec-WebSocket-Origin"] = opts.origin;
        } else {
          opts.headers.Origin = opts.origin;
        }
      }
      if (parsedUrl.username || parsedUrl.password) {
        opts.auth = `${parsedUrl.username}:${parsedUrl.password}`;
      }
      if (isIpcUrl) {
        const parts = opts.path.split(":");
        opts.socketPath = parts[0];
        opts.path = parts[1];
      }
      let req;
      if (opts.followRedirects) {
        if (websocket._redirects === 0) {
          websocket._originalIpc = isIpcUrl;
          websocket._originalSecure = isSecure;
          websocket._originalHostOrSocketPath = isIpcUrl ? opts.socketPath : parsedUrl.host;
          const headers = options && options.headers;
          options = { ...options, headers: {} };
          if (headers) {
            for (const [key2, value] of Object.entries(headers)) {
              options.headers[key2.toLowerCase()] = value;
            }
          }
        } else if (websocket.listenerCount("redirect") === 0) {
          const isSameHost = isIpcUrl ? websocket._originalIpc ? opts.socketPath === websocket._originalHostOrSocketPath : false : websocket._originalIpc ? false : parsedUrl.host === websocket._originalHostOrSocketPath;
          if (!isSameHost || websocket._originalSecure && !isSecure) {
            delete opts.headers.authorization;
            delete opts.headers.cookie;
            if (!isSameHost) delete opts.headers.host;
            opts.auth = void 0;
          }
        }
        if (opts.auth && !options.headers.authorization) {
          options.headers.authorization = "Basic " + Buffer.from(opts.auth).toString("base64");
        }
        req = websocket._req = request(opts);
        if (websocket._redirects) {
          websocket.emit("redirect", websocket.url, req);
        }
      } else {
        req = websocket._req = request(opts);
      }
      if (opts.timeout) {
        req.on("timeout", () => {
          abortHandshake(websocket, req, "Opening handshake has timed out");
        });
      }
      req.on("error", (err) => {
        if (req === null || req[kAborted]) return;
        req = websocket._req = null;
        emitErrorAndClose(websocket, err);
      });
      req.on("response", (res) => {
        const location = res.headers.location;
        const statusCode = res.statusCode;
        if (location && opts.followRedirects && statusCode >= 300 && statusCode < 400) {
          if (++websocket._redirects > opts.maxRedirects) {
            abortHandshake(websocket, req, "Maximum redirects exceeded");
            return;
          }
          req.abort();
          let addr;
          try {
            addr = new URL3(location, address);
          } catch (e) {
            const err = new SyntaxError(`Invalid URL: ${location}`);
            emitErrorAndClose(websocket, err);
            return;
          }
          initAsClient(websocket, addr, protocols, options);
        } else if (!websocket.emit("unexpected-response", req, res)) {
          abortHandshake(
            websocket,
            req,
            `Unexpected server response: ${res.statusCode}`
          );
        }
      });
      req.on("upgrade", (res, socket, head) => {
        websocket.emit("upgrade", res);
        if (websocket.readyState !== WebSocket2.CONNECTING) return;
        req = websocket._req = null;
        const upgrade = res.headers.upgrade;
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          abortHandshake(websocket, socket, "Invalid Upgrade header");
          return;
        }
        const digest = createHash4("sha1").update(key + GUID).digest("base64");
        if (res.headers["sec-websocket-accept"] !== digest) {
          abortHandshake(websocket, socket, "Invalid Sec-WebSocket-Accept header");
          return;
        }
        const serverProt = res.headers["sec-websocket-protocol"];
        let protError;
        if (serverProt !== void 0) {
          if (!protocolSet.size) {
            protError = "Server sent a subprotocol but none was requested";
          } else if (!protocolSet.has(serverProt)) {
            protError = "Server sent an invalid subprotocol";
          }
        } else if (protocolSet.size) {
          protError = "Server sent no subprotocol";
        }
        if (protError) {
          abortHandshake(websocket, socket, protError);
          return;
        }
        if (serverProt) websocket._protocol = serverProt;
        const secWebSocketExtensions = res.headers["sec-websocket-extensions"];
        if (secWebSocketExtensions !== void 0) {
          if (!perMessageDeflate) {
            const message = "Server sent a Sec-WebSocket-Extensions header but no extension was requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          let extensions;
          try {
            extensions = parse(secWebSocketExtensions);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          const extensionNames = Object.keys(extensions);
          if (extensionNames.length !== 1 || extensionNames[0] !== PerMessageDeflate2.extensionName) {
            const message = "Server indicated an extension that was not requested";
            abortHandshake(websocket, socket, message);
            return;
          }
          try {
            perMessageDeflate.accept(extensions[PerMessageDeflate2.extensionName]);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Extensions header";
            abortHandshake(websocket, socket, message);
            return;
          }
          websocket._extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
        }
        websocket.setSocket(socket, head, {
          allowSynchronousEvents: opts.allowSynchronousEvents,
          generateMask: opts.generateMask,
          maxBufferedChunks: opts.maxBufferedChunks,
          maxFragments: opts.maxFragments,
          maxPayload: opts.maxPayload,
          skipUTF8Validation: opts.skipUTF8Validation
        });
      });
      if (opts.finishRequest) {
        opts.finishRequest(req, websocket);
      } else {
        req.end();
      }
    }
    function emitErrorAndClose(websocket, err) {
      websocket._readyState = WebSocket2.CLOSING;
      websocket._errorEmitted = true;
      websocket.emit("error", err);
      websocket.emitClose();
    }
    function netConnect(options) {
      options.path = options.socketPath;
      return net.connect(options);
    }
    function tlsConnect(options) {
      options.path = void 0;
      if (!options.servername && options.servername !== "") {
        options.servername = net.isIP(options.host) ? "" : options.host;
      }
      return tls.connect(options);
    }
    function abortHandshake(websocket, stream, message) {
      websocket._readyState = WebSocket2.CLOSING;
      const err = new Error(message);
      Error.captureStackTrace(err, abortHandshake);
      if (stream.setHeader) {
        stream[kAborted] = true;
        stream.abort();
        if (stream.socket && !stream.socket.destroyed) {
          stream.socket.destroy();
        }
        process.nextTick(emitErrorAndClose, websocket, err);
      } else {
        stream.destroy(err);
        stream.once("error", websocket.emit.bind(websocket, "error"));
        stream.once("close", websocket.emitClose.bind(websocket));
      }
    }
    function sendAfterClose(websocket, data, cb) {
      if (data) {
        const length = isBlob(data) ? data.size : toBuffer(data).length;
        if (websocket._socket) websocket._sender._bufferedBytes += length;
        else websocket._bufferedAmount += length;
      }
      if (cb) {
        const err = new Error(
          `WebSocket is not open: readyState ${websocket.readyState} (${readyStates[websocket.readyState]})`
        );
        process.nextTick(cb, err);
      }
    }
    function receiverOnConclude(code, reason) {
      const websocket = this[kWebSocket];
      websocket._closeFrameReceived = true;
      websocket._closeMessage = reason;
      websocket._closeCode = code;
      if (websocket._socket[kWebSocket] === void 0) return;
      websocket._socket.removeListener("data", socketOnData);
      process.nextTick(resume, websocket._socket);
      if (code === 1005) websocket.close();
      else websocket.close(code, reason);
    }
    function receiverOnDrain() {
      const websocket = this[kWebSocket];
      if (!websocket.isPaused) websocket._socket.resume();
    }
    function receiverOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket._socket[kWebSocket] !== void 0) {
        websocket._socket.removeListener("data", socketOnData);
        process.nextTick(resume, websocket._socket);
        websocket.close(err[kStatusCode]);
      }
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function receiverOnFinish() {
      this[kWebSocket].emitClose();
    }
    function receiverOnMessage(data, isBinary) {
      this[kWebSocket].emit("message", data, isBinary);
    }
    function receiverOnPing(data) {
      const websocket = this[kWebSocket];
      if (websocket._autoPong) websocket.pong(data, !this._isServer, NOOP);
      websocket.emit("ping", data);
    }
    function receiverOnPong(data) {
      this[kWebSocket].emit("pong", data);
    }
    function resume(stream) {
      stream.resume();
    }
    function senderOnError(err) {
      const websocket = this[kWebSocket];
      if (websocket.readyState === WebSocket2.CLOSED) return;
      if (websocket.readyState === WebSocket2.OPEN) {
        websocket._readyState = WebSocket2.CLOSING;
        setCloseTimer(websocket);
      }
      this._socket.end();
      if (!websocket._errorEmitted) {
        websocket._errorEmitted = true;
        websocket.emit("error", err);
      }
    }
    function setCloseTimer(websocket) {
      websocket._closeTimer = setTimeout(
        websocket._socket.destroy.bind(websocket._socket),
        websocket._closeTimeout
      );
    }
    function socketOnClose() {
      const websocket = this[kWebSocket];
      this.removeListener("close", socketOnClose);
      this.removeListener("data", socketOnData);
      this.removeListener("end", socketOnEnd);
      websocket._readyState = WebSocket2.CLOSING;
      if (!this._readableState.endEmitted && !websocket._closeFrameReceived && !websocket._receiver._writableState.errorEmitted && this._readableState.length !== 0) {
        const chunk = this.read(this._readableState.length);
        websocket._receiver.write(chunk);
      }
      websocket._receiver.end();
      this[kWebSocket] = void 0;
      clearTimeout(websocket._closeTimer);
      if (websocket._receiver._writableState.finished || websocket._receiver._writableState.errorEmitted) {
        websocket.emitClose();
      } else {
        websocket._receiver.on("error", receiverOnFinish);
        websocket._receiver.on("finish", receiverOnFinish);
      }
    }
    function socketOnData(chunk) {
      if (!this[kWebSocket]._receiver.write(chunk)) {
        this.pause();
      }
    }
    function socketOnEnd() {
      const websocket = this[kWebSocket];
      websocket._readyState = WebSocket2.CLOSING;
      websocket._receiver.end();
      this.end();
    }
    function socketOnError() {
      const websocket = this[kWebSocket];
      this.removeListener("error", socketOnError);
      this.on("error", NOOP);
      if (websocket) {
        websocket._readyState = WebSocket2.CLOSING;
        this.destroy();
      }
    }
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/stream.js
var require_stream = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/stream.js"(exports, module) {
    "use strict";
    var WebSocket2 = require_websocket();
    var { Duplex } = __require("stream");
    function emitClose(stream) {
      stream.emit("close");
    }
    function duplexOnEnd() {
      if (!this.destroyed && this._writableState.finished) {
        this.destroy();
      }
    }
    function duplexOnError(err) {
      this.removeListener("error", duplexOnError);
      this.destroy();
      if (this.listenerCount("error") === 0) {
        this.emit("error", err);
      }
    }
    function createWebSocketStream2(ws, options) {
      let terminateOnDestroy = true;
      const duplex = new Duplex({
        ...options,
        autoDestroy: false,
        emitClose: false,
        objectMode: false,
        writableObjectMode: false
      });
      ws.on("message", function message(msg, isBinary) {
        const data = !isBinary && duplex._readableState.objectMode ? msg.toString() : msg;
        if (!duplex.push(data)) ws.pause();
      });
      ws.once("error", function error(err) {
        if (duplex.destroyed) return;
        terminateOnDestroy = false;
        duplex.destroy(err);
      });
      ws.once("close", function close() {
        if (duplex.destroyed) return;
        duplex.push(null);
      });
      duplex._destroy = function(err, callback) {
        if (ws.readyState === ws.CLOSED) {
          callback(err);
          process.nextTick(emitClose, duplex);
          return;
        }
        let called = false;
        ws.once("error", function error(err2) {
          called = true;
          callback(err2);
        });
        ws.once("close", function close() {
          if (!called) callback(err);
          process.nextTick(emitClose, duplex);
        });
        if (terminateOnDestroy) ws.terminate();
      };
      duplex._final = function(callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open2() {
            duplex._final(callback);
          });
          return;
        }
        if (ws._socket === null) return;
        if (ws._socket._writableState.finished) {
          callback();
          if (duplex._readableState.endEmitted) duplex.destroy();
        } else {
          ws._socket.once("finish", function finish() {
            callback();
          });
          ws.close();
        }
      };
      duplex._read = function() {
        if (ws.isPaused) ws.resume();
      };
      duplex._write = function(chunk, encoding, callback) {
        if (ws.readyState === ws.CONNECTING) {
          ws.once("open", function open2() {
            duplex._write(chunk, encoding, callback);
          });
          return;
        }
        ws.send(chunk, callback);
      };
      duplex.on("end", duplexOnEnd);
      duplex.on("error", duplexOnError);
      return duplex;
    }
    module.exports = createWebSocketStream2;
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/subprotocol.js
var require_subprotocol = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/subprotocol.js"(exports, module) {
    "use strict";
    var { tokenChars } = require_validation();
    function parse(header) {
      const protocols = /* @__PURE__ */ new Set();
      let start = -1;
      let end = -1;
      let i = 0;
      for (i; i < header.length; i++) {
        const code = header.charCodeAt(i);
        if (end === -1 && tokenChars[code] === 1) {
          if (start === -1) start = i;
        } else if (i !== 0 && (code === 32 || code === 9)) {
          if (end === -1 && start !== -1) end = i;
        } else if (code === 44) {
          if (start === -1) {
            throw new SyntaxError(`Unexpected character at index ${i}`);
          }
          if (end === -1) end = i;
          const protocol2 = header.slice(start, end);
          if (protocols.has(protocol2)) {
            throw new SyntaxError(`The "${protocol2}" subprotocol is duplicated`);
          }
          protocols.add(protocol2);
          start = end = -1;
        } else {
          throw new SyntaxError(`Unexpected character at index ${i}`);
        }
      }
      if (start === -1 || end !== -1) {
        throw new SyntaxError("Unexpected end of input");
      }
      const protocol = header.slice(start, i);
      if (protocols.has(protocol)) {
        throw new SyntaxError(`The "${protocol}" subprotocol is duplicated`);
      }
      protocols.add(protocol);
      return protocols;
    }
    module.exports = { parse };
  }
});

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket-server.js
var require_websocket_server = __commonJS({
  "../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/lib/websocket-server.js"(exports, module) {
    "use strict";
    var EventEmitter3 = __require("events");
    var http2 = __require("http");
    var { Duplex } = __require("stream");
    var { createHash: createHash4 } = __require("crypto");
    var extension2 = require_extension();
    var PerMessageDeflate2 = require_permessage_deflate();
    var subprotocol2 = require_subprotocol();
    var WebSocket2 = require_websocket();
    var { CLOSE_TIMEOUT, GUID, kWebSocket } = require_constants();
    var keyRegex = /^[+/0-9A-Za-z]{22}==$/;
    var RUNNING = 0;
    var CLOSING = 1;
    var CLOSED = 2;
    var WebSocketServer2 = class extends EventEmitter3 {
      /**
       * Create a `WebSocketServer` instance.
       *
       * @param {Object} options Configuration options
       * @param {Boolean} [options.allowSynchronousEvents=true] Specifies whether
       *     any of the `'message'`, `'ping'`, and `'pong'` events can be emitted
       *     multiple times in the same tick
       * @param {Boolean} [options.autoPong=true] Specifies whether or not to
       *     automatically send a pong in response to a ping
       * @param {Number} [options.backlog=511] The maximum length of the queue of
       *     pending connections
       * @param {Boolean} [options.clientTracking=true] Specifies whether or not to
       *     track clients
       * @param {Number} [options.closeTimeout=30000] Duration in milliseconds to
       *     wait for the closing handshake to finish after `websocket.close()` is
       *     called
       * @param {Function} [options.handleProtocols] A hook to handle protocols
       * @param {String} [options.host] The hostname where to bind the server
       * @param {Number} [options.maxBufferedChunks=1048576] The maximum number of
       *     buffered data chunks
       * @param {Number} [options.maxFragments=131072] The maximum number of message
       *     fragments
       * @param {Number} [options.maxPayload=104857600] The maximum allowed message
       *     size
       * @param {Boolean} [options.noServer=false] Enable no server mode
       * @param {String} [options.path] Accept only connections matching this path
       * @param {(Boolean|Object)} [options.perMessageDeflate=false] Enable/disable
       *     permessage-deflate
       * @param {Number} [options.port] The port where to bind the server
       * @param {(http.Server|https.Server)} [options.server] A pre-created HTTP/S
       *     server to use
       * @param {Boolean} [options.skipUTF8Validation=false] Specifies whether or
       *     not to skip UTF-8 validation for text and close messages
       * @param {Function} [options.verifyClient] A hook to reject connections
       * @param {Function} [options.WebSocket=WebSocket] Specifies the `WebSocket`
       *     class to use. It must be the `WebSocket` class or class that extends it
       * @param {Function} [callback] A listener for the `listening` event
       */
      constructor(options, callback) {
        super();
        options = {
          allowSynchronousEvents: true,
          autoPong: true,
          maxBufferedChunks: 1024 * 1024,
          maxFragments: 128 * 1024,
          maxPayload: 100 * 1024 * 1024,
          skipUTF8Validation: false,
          perMessageDeflate: false,
          handleProtocols: null,
          clientTracking: true,
          closeTimeout: CLOSE_TIMEOUT,
          verifyClient: null,
          noServer: false,
          backlog: null,
          // use default (511 as implemented in net.js)
          server: null,
          host: null,
          path: null,
          port: null,
          WebSocket: WebSocket2,
          ...options
        };
        if (options.port == null && !options.server && !options.noServer || options.port != null && (options.server || options.noServer) || options.server && options.noServer) {
          throw new TypeError(
            'One and only one of the "port", "server", or "noServer" options must be specified'
          );
        }
        if (options.port != null) {
          this._server = http2.createServer((req, res) => {
            const body = http2.STATUS_CODES[426];
            res.writeHead(426, {
              "Content-Length": body.length,
              "Content-Type": "text/plain"
            });
            res.end(body);
          });
          this._server.listen(
            options.port,
            options.host,
            options.backlog,
            callback
          );
        } else if (options.server) {
          this._server = options.server;
        }
        if (this._server) {
          const emitConnection = this.emit.bind(this, "connection");
          this._removeListeners = addListeners(this._server, {
            listening: this.emit.bind(this, "listening"),
            error: this.emit.bind(this, "error"),
            upgrade: (req, socket, head) => {
              this.handleUpgrade(req, socket, head, emitConnection);
            }
          });
        }
        if (options.perMessageDeflate === true) options.perMessageDeflate = {};
        if (options.clientTracking) {
          this.clients = /* @__PURE__ */ new Set();
          this._shouldEmitClose = false;
        }
        this.options = options;
        this._state = RUNNING;
      }
      /**
       * Returns the bound address, the address family name, and port of the server
       * as reported by the operating system if listening on an IP socket.
       * If the server is listening on a pipe or UNIX domain socket, the name is
       * returned as a string.
       *
       * @return {(Object|String|null)} The address of the server
       * @public
       */
      address() {
        if (this.options.noServer) {
          throw new Error('The server is operating in "noServer" mode');
        }
        if (!this._server) return null;
        return this._server.address();
      }
      /**
       * Stop the server from accepting new connections and emit the `'close'` event
       * when all existing connections are closed.
       *
       * @param {Function} [cb] A one-time listener for the `'close'` event
       * @public
       */
      close(cb) {
        if (this._state === CLOSED) {
          if (cb) {
            this.once("close", () => {
              cb(new Error("The server is not running"));
            });
          }
          process.nextTick(emitClose, this);
          return;
        }
        if (cb) this.once("close", cb);
        if (this._state === CLOSING) return;
        this._state = CLOSING;
        if (this.options.noServer || this.options.server) {
          if (this._server) {
            this._removeListeners();
            this._removeListeners = this._server = null;
          }
          if (this.clients) {
            if (!this.clients.size) {
              process.nextTick(emitClose, this);
            } else {
              this._shouldEmitClose = true;
            }
          } else {
            process.nextTick(emitClose, this);
          }
        } else {
          const server = this._server;
          this._removeListeners();
          this._removeListeners = this._server = null;
          server.close(() => {
            emitClose(this);
          });
        }
      }
      /**
       * See if a given request should be handled by this server instance.
       *
       * @param {http.IncomingMessage} req Request object to inspect
       * @return {Boolean} `true` if the request is valid, else `false`
       * @public
       */
      shouldHandle(req) {
        if (this.options.path) {
          const index = req.url.indexOf("?");
          const pathname = index !== -1 ? req.url.slice(0, index) : req.url;
          if (pathname !== this.options.path) return false;
        }
        return true;
      }
      /**
       * Handle a HTTP Upgrade request.
       *
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @public
       */
      handleUpgrade(req, socket, head, cb) {
        socket.on("error", socketOnError);
        const key = req.headers["sec-websocket-key"];
        const upgrade = req.headers.upgrade;
        const version = +req.headers["sec-websocket-version"];
        if (req.method !== "GET") {
          const message = "Invalid HTTP method";
          abortHandshakeOrEmitwsClientError(this, req, socket, 405, message);
          return;
        }
        if (upgrade === void 0 || upgrade.toLowerCase() !== "websocket") {
          const message = "Invalid Upgrade header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (key === void 0 || !keyRegex.test(key)) {
          const message = "Missing or invalid Sec-WebSocket-Key header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
          return;
        }
        if (version !== 13 && version !== 8) {
          const message = "Missing or invalid Sec-WebSocket-Version header";
          abortHandshakeOrEmitwsClientError(this, req, socket, 400, message, {
            "Sec-WebSocket-Version": "13, 8"
          });
          return;
        }
        if (!this.shouldHandle(req)) {
          abortHandshake(socket, 400);
          return;
        }
        const secWebSocketProtocol = req.headers["sec-websocket-protocol"];
        let protocols = /* @__PURE__ */ new Set();
        if (secWebSocketProtocol !== void 0) {
          try {
            protocols = subprotocol2.parse(secWebSocketProtocol);
          } catch (err) {
            const message = "Invalid Sec-WebSocket-Protocol header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        const secWebSocketExtensions = req.headers["sec-websocket-extensions"];
        const extensions = {};
        if (this.options.perMessageDeflate && secWebSocketExtensions !== void 0) {
          const perMessageDeflate = new PerMessageDeflate2({
            ...this.options.perMessageDeflate,
            isServer: true,
            maxPayload: this.options.maxPayload
          });
          try {
            const offers = extension2.parse(secWebSocketExtensions);
            if (offers[PerMessageDeflate2.extensionName]) {
              perMessageDeflate.accept(offers[PerMessageDeflate2.extensionName]);
              extensions[PerMessageDeflate2.extensionName] = perMessageDeflate;
            }
          } catch (err) {
            const message = "Invalid or unacceptable Sec-WebSocket-Extensions header";
            abortHandshakeOrEmitwsClientError(this, req, socket, 400, message);
            return;
          }
        }
        if (this.options.verifyClient) {
          const info = {
            origin: req.headers[`${version === 8 ? "sec-websocket-origin" : "origin"}`],
            secure: !!(req.socket.authorized || req.socket.encrypted),
            req
          };
          if (this.options.verifyClient.length === 2) {
            this.options.verifyClient(info, (verified, code, message, headers) => {
              if (!verified) {
                return abortHandshake(socket, code || 401, message, headers);
              }
              this.completeUpgrade(
                extensions,
                key,
                protocols,
                req,
                socket,
                head,
                cb
              );
            });
            return;
          }
          if (!this.options.verifyClient(info)) return abortHandshake(socket, 401);
        }
        this.completeUpgrade(extensions, key, protocols, req, socket, head, cb);
      }
      /**
       * Upgrade the connection to WebSocket.
       *
       * @param {Object} extensions The accepted extensions
       * @param {String} key The value of the `Sec-WebSocket-Key` header
       * @param {Set} protocols The subprotocols
       * @param {http.IncomingMessage} req The request object
       * @param {Duplex} socket The network socket between the server and client
       * @param {Buffer} head The first packet of the upgraded stream
       * @param {Function} cb Callback
       * @throws {Error} If called more than once with the same socket
       * @private
       */
      completeUpgrade(extensions, key, protocols, req, socket, head, cb) {
        if (!socket.readable || !socket.writable) return socket.destroy();
        if (socket[kWebSocket]) {
          throw new Error(
            "server.handleUpgrade() was called more than once with the same socket, possibly due to a misconfiguration"
          );
        }
        if (this._state > RUNNING) return abortHandshake(socket, 503);
        const digest = createHash4("sha1").update(key + GUID).digest("base64");
        const headers = [
          "HTTP/1.1 101 Switching Protocols",
          "Upgrade: websocket",
          "Connection: Upgrade",
          `Sec-WebSocket-Accept: ${digest}`
        ];
        const ws = new this.options.WebSocket(null, void 0, this.options);
        if (protocols.size) {
          const protocol = this.options.handleProtocols ? this.options.handleProtocols(protocols, req) : protocols.values().next().value;
          if (protocol) {
            headers.push(`Sec-WebSocket-Protocol: ${protocol}`);
            ws._protocol = protocol;
          }
        }
        if (extensions[PerMessageDeflate2.extensionName]) {
          const params = extensions[PerMessageDeflate2.extensionName].params;
          const value = extension2.format({
            [PerMessageDeflate2.extensionName]: [params]
          });
          headers.push(`Sec-WebSocket-Extensions: ${value}`);
          ws._extensions = extensions;
        }
        this.emit("headers", headers, req);
        socket.write(headers.concat("\r\n").join("\r\n"));
        socket.removeListener("error", socketOnError);
        ws.setSocket(socket, head, {
          allowSynchronousEvents: this.options.allowSynchronousEvents,
          maxBufferedChunks: this.options.maxBufferedChunks,
          maxFragments: this.options.maxFragments,
          maxPayload: this.options.maxPayload,
          skipUTF8Validation: this.options.skipUTF8Validation
        });
        if (this.clients) {
          this.clients.add(ws);
          ws.on("close", () => {
            this.clients.delete(ws);
            if (this._shouldEmitClose && !this.clients.size) {
              process.nextTick(emitClose, this);
            }
          });
        }
        cb(ws, req);
      }
    };
    module.exports = WebSocketServer2;
    function addListeners(server, map) {
      for (const event of Object.keys(map)) server.on(event, map[event]);
      return function removeListeners() {
        for (const event of Object.keys(map)) {
          server.removeListener(event, map[event]);
        }
      };
    }
    function emitClose(server) {
      server._state = CLOSED;
      server.emit("close");
    }
    function socketOnError() {
      this.destroy();
    }
    function abortHandshake(socket, code, message, headers) {
      message = message || http2.STATUS_CODES[code];
      headers = {
        Connection: "close",
        "Content-Type": "text/html",
        "Content-Length": Buffer.byteLength(message),
        ...headers
      };
      socket.once("finish", socket.destroy);
      socket.end(
        `HTTP/1.1 ${code} ${http2.STATUS_CODES[code]}\r
` + Object.keys(headers).map((h) => `${h}: ${headers[h]}`).join("\r\n") + "\r\n\r\n" + message
      );
    }
    function abortHandshakeOrEmitwsClientError(server, req, socket, code, message, headers) {
      if (server.listenerCount("wsClientError")) {
        const err = new Error(message);
        Error.captureStackTrace(err, abortHandshakeOrEmitwsClientError);
        server.emit("wsClientError", err, socket, req);
      } else {
        abortHandshake(socket, code, message, headers);
      }
    }
  }
});

// src/main.ts
import http from "node:http";
import { execSync } from "node:child_process";
import { URL as URL2 } from "node:url";
import { performance } from "node:perf_hooks";

// src/services.ts
import path24 from "node:path";

// ../../packages/core/src/llm/types.ts
var DEFAULT_FETCH_TIMEOUT_MS = 3e5;
var DEFAULT_STREAM_IDLE_TIMEOUT_MS = 12e4;
function combinedSignal(external, timeoutMs) {
  if (!timeoutMs || !Number.isFinite(timeoutMs)) {
    if (external) return external;
    const ctrl = new AbortController();
    return ctrl.signal;
  }
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(new Error(`LLM fetch timeout after ${timeoutMs}ms`)), timeoutMs);
  if (typeof timer.unref === "function") timer.unref();
  if (external) {
    if (external.aborted) {
      clearTimeout(timer);
      controller.abort(external.reason);
      return controller.signal;
    }
    external.addEventListener("abort", () => {
      clearTimeout(timer);
      controller.abort(external.reason);
    });
  }
  controller.signal.addEventListener("abort", () => clearTimeout(timer));
  return controller.signal;
}
function readWithIdleTimeout(reader, idleMs) {
  if (!idleMs || !Number.isFinite(idleMs)) {
    return reader.read();
  }
  return new Promise((resolve3, reject) => {
    let timer = setTimeout(() => {
      timer = null;
      reader.cancel().catch(() => {
      });
      reject(new Error(`Stream idle timeout: no data for ${idleMs}ms`));
    }, idleMs);
    if (typeof timer.unref === "function") timer.unref();
    reader.read().then(
      (result) => {
        if (timer) clearTimeout(timer);
        resolve3(result);
      },
      (err) => {
        if (timer) clearTimeout(timer);
        reject(err);
      }
    );
  });
}

// ../../packages/core/src/llm/openai.ts
var OpenAICompatProvider = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  name = "openai-compat";
  /** 自动推断当前模型是否支持 vision（针对 DashScope/通义千问等需要显式区分 VL 模型的端点） */
  inferVisionSupport() {
    if (this.opts.supportsVision !== void 0) return this.opts.supportsVision;
    const baseURL = this.opts.baseURL.toLowerCase();
    const model = (this.opts.defaultModel ?? "").toLowerCase();
    if (baseURL.includes("dashscope")) {
      return /qwen.*-vl|qwen-vl/i.test(model);
    }
    return true;
  }
  async *chatStream(messages, opts = {}) {
    const useAnthropicCache = !!this.opts.enableAnthropicCache;
    const supportsVision = this.inferVisionSupport();
    const buildBody = (stripImages) => ({
      model: opts.model ?? this.opts.defaultModel ?? "gpt-4o-mini",
      messages: messages.map((m) => {
        const multimodal = m._multimodal;
        let content;
        if (multimodal && supportsVision && !stripImages) {
          content = multimodal.map((block) => {
            if (block.type === "text") return { type: "text", text: block.text };
            if (block.type === "image" && block.source) {
              return {
                type: "image_url",
                image_url: {
                  url: `data:${block.source.media_type};base64,${block.source.data}`
                }
              };
            }
            return block;
          });
        } else if (multimodal && (!supportsVision || stripImages)) {
          const textBlock = multimodal.find((b) => b.type === "text");
          const imageCount = multimodal.filter((b) => b.type === "image").length;
          content = (textBlock?.text ?? m.content) + (imageCount > 0 ? `
[\u7528\u6237\u9644\u5E26\u4E86 ${imageCount} \u5F20\u56FE\u7247\uFF0C\u4F46\u5F53\u524D\u6A21\u578B\u4E0D\u652F\u6301\u56FE\u7247\u8BC6\u522B]` : "");
        } else if (useAnthropicCache && m.cacheHint === "ephemeral") {
          content = [{ type: "text", text: m.content, cache_control: { type: "ephemeral" } }];
        } else {
          content = m.content;
        }
        const base = {
          role: m.role,
          content
        };
        if (m.tool_calls?.length) {
          base.tool_calls = m.tool_calls.map((t) => ({
            id: t.id,
            type: "function",
            function: { name: t.name, arguments: JSON.stringify(t.arguments) }
          }));
        }
        if (m.tool_call_id) base.tool_call_id = m.tool_call_id;
        if (m.name) base.name = m.name;
        return base;
      }),
      stream: true,
      temperature: opts.temperature ?? 0.2,
      tools: opts.tools?.map((t) => ({
        type: "function",
        function: { name: t.name, description: t.description, parameters: t.parameters }
      }))
    });
    const applyResponseFormat = (body2) => {
      if (opts.responseFormat) {
        body2.response_format = opts.responseFormat;
      }
    };
    let body = buildBody(false);
    applyResponseFormat(body);
    const fetchTimeout = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const idleTimeout = opts.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    const fetchSig = combinedSignal(opts.signal, fetchTimeout);
    let resp = await fetch(`${this.opts.baseURL.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify(body),
      signal: fetchSig
    });
    if (resp.status === 400) {
      const errBody = await resp.text().catch(() => "");
      const hasImages = messages.some((m) => !!m._multimodal);
      if (hasImages) {
        console.warn("[OpenAI Provider] 400 error with images, retrying without images...", errBody);
        body = buildBody(true);
        applyResponseFormat(body);
        resp = await fetch(`${this.opts.baseURL.replace(/\/$/, "")}/chat/completions`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${this.opts.apiKey}`,
            "Content-Type": "application/json"
          },
          body: JSON.stringify(body),
          signal: fetchSig
        });
        if (resp.ok && resp.body) {
          yield { delta: "\n\n> \u26A0\uFE0F \u5F53\u524D\u6A21\u578B\u4E0D\u652F\u6301\u56FE\u7247\u8BC6\u522B\uFF0C\u5DF2\u81EA\u52A8\u5265\u79BB\u56FE\u7247\u7EE7\u7EED\u5BF9\u8BDD\u3002\u5982\u9700\u56FE\u7247\u8BC6\u522B\uFF0C\u8BF7\u5728\u6A21\u578B\u8BBE\u7F6E\u4E2D\u5207\u6362\u5230\u652F\u6301\u89C6\u89C9\u7684\u6A21\u578B\uFF08\u5982 qwen-vl-max\uFF09\u3002\n\n" };
        } else if (!resp.ok) {
          const retryErrBody = await resp.text().catch(() => "");
          throw new Error(`LLM HTTP 400 (\u91CD\u8BD5\u5265\u79BB\u56FE\u7247\u540E\u4ECD\u5931\u8D25): \u539F\u59CB\u9519\u8BEF=${errBody}; \u91CD\u8BD5\u9519\u8BEF=HTTP ${resp.status}: ${retryErrBody}`);
        }
      } else {
        throw new Error(`LLM HTTP 400: ${errBody}`);
      }
    }
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => "");
      throw new Error(`LLM HTTP ${resp.status}: ${text}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    while (true) {
      const { value, done } = await readWithIdleTimeout(reader, idleTimeout);
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const lines = buf.split("\n");
      buf = lines.pop() ?? "";
      for (const raw of lines) {
        const line = raw.trim();
        if (!line.startsWith("data:")) continue;
        const data = line.slice(5).trim();
        if (data === "[DONE]") {
          yield { done: true };
          return;
        }
        try {
          const json = JSON.parse(data);
          if (json.usage) {
            yield {
              usage: {
                promptTokens: json.usage.prompt_tokens ?? json.usage.input_tokens,
                completionTokens: json.usage.completion_tokens ?? json.usage.output_tokens,
                cachedPromptTokens: json.usage.prompt_tokens_details?.cached_tokens ?? json.usage.cache_read_input_tokens
              }
            };
          }
          const choice = json.choices?.[0];
          if (!choice) continue;
          const delta = choice.delta ?? {};
          if (typeof delta.content === "string" && delta.content.length) {
            yield { delta: delta.content };
          }
          if (Array.isArray(delta.tool_calls)) {
            for (const tc of delta.tool_calls) {
              yield {
                toolCallDelta: {
                  index: tc.index ?? 0,
                  id: tc.id,
                  name: tc.function?.name,
                  arguments: tc.function?.arguments
                }
              };
            }
          }
          if (choice.finish_reason) {
            yield { finishReason: choice.finish_reason };
          }
        } catch {
        }
      }
    }
  }
  async embed(texts) {
    const resp = await fetch(`${this.opts.baseURL.replace(/\/$/, "")}/embeddings`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${this.opts.apiKey}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: this.opts.embedModel ?? "text-embedding-3-small",
        input: texts
      })
    });
    if (!resp.ok) throw new Error(`Embed HTTP ${resp.status}`);
    const json = await resp.json();
    return json.data.map((d) => d.embedding);
  }
};

// ../../packages/core/src/llm/anthropic.ts
var AnthropicProvider = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  name = "anthropic";
  async *chatStream(messages, opts = {}) {
    const systemParts = [];
    const convMsgs = [];
    for (const m of messages) {
      if (m.role === "system") {
        systemParts.push(m.content);
      } else {
        convMsgs.push(m);
      }
    }
    const systemText = systemParts.join("\n\n");
    const useCache = this.opts.enableCacheControl !== false;
    const anthroMessages = transformMessages(convMsgs, useCache);
    const anthroTools = opts.tools?.map((t) => ({
      name: t.name,
      description: t.description,
      input_schema: t.parameters
    }));
    const body = {
      model: opts.model ?? this.opts.defaultModel ?? "claude-3-5-sonnet-20241022",
      max_tokens: this.opts.maxTokens ?? 4096,
      stream: true,
      temperature: opts.temperature ?? 0.2,
      messages: anthroMessages
    };
    const thinkingBudget = this.opts.thinkingBudget ?? 0;
    if (thinkingBudget > 0) {
      body.thinking = {
        type: "enabled",
        budget_tokens: thinkingBudget
      };
      body.temperature = 1;
      if (useCache) {
        body._betaHeaders = ["prompt-caching-2024-07-31", "extended-thinking-2025-01-24"];
      }
    }
    if (systemText) {
      body.system = useCache ? [{ type: "text", text: systemText, cache_control: { type: "ephemeral" } }] : systemText;
    }
    if (anthroTools && anthroTools.length) {
      if (useCache) {
        const lastIdx = anthroTools.length - 1;
        anthroTools[lastIdx] = {
          ...anthroTools[lastIdx],
          cache_control: { type: "ephemeral" }
        };
      }
      body.tools = anthroTools;
    }
    const url = `${(this.opts.baseURL ?? "https://api.anthropic.com").replace(/\/$/, "")}/v1/messages`;
    const fetchTimeout = opts.fetchTimeoutMs ?? DEFAULT_FETCH_TIMEOUT_MS;
    const idleTimeout = opts.streamIdleTimeoutMs ?? DEFAULT_STREAM_IDLE_TIMEOUT_MS;
    const fetchSig = combinedSignal(opts.signal, fetchTimeout);
    const resp = await fetch(url, {
      method: "POST",
      headers: {
        "x-api-key": this.opts.apiKey,
        "anthropic-version": this.opts.apiVersion ?? "2023-06-01",
        "content-type": "application/json",
        // 让 prompt caching 工作（beta header 可选；2024-09 之后已 GA，但加上更稳）
        ...useCache ? { "anthropic-beta": "prompt-caching-2024-07-31" } : {},
        // Extended Thinking beta header
        ...body._betaHeaders?.length ? { "anthropic-beta": body._betaHeaders.join(",") } : {}
      },
      body: JSON.stringify(body),
      signal: fetchSig
    });
    if (!resp.ok || !resp.body) {
      const text = await resp.text().catch(() => "");
      throw new Error(`Anthropic HTTP ${resp.status}: ${text}`);
    }
    const reader = resp.body.getReader();
    const decoder = new TextDecoder("utf-8");
    let buf = "";
    const toolUseAcc = /* @__PURE__ */ new Map();
    let usagePrompt = 0;
    let usageCachedRead = 0;
    let usageCompletion = 0;
    while (true) {
      const { value, done } = await readWithIdleTimeout(reader, idleTimeout);
      if (done) break;
      buf += decoder.decode(value, { stream: true });
      const events = buf.split(/\n\n/);
      buf = events.pop() ?? "";
      for (const block of events) {
        const lines = block.split("\n");
        let evType = "";
        let data = "";
        for (const ln of lines) {
          if (ln.startsWith("event:")) evType = ln.slice(6).trim();
          else if (ln.startsWith("data:")) data = ln.slice(5).trim();
        }
        if (!data) continue;
        let json;
        try {
          json = JSON.parse(data);
        } catch {
          continue;
        }
        switch (evType) {
          case "message_start": {
            const u = json.message?.usage;
            if (u) {
              usagePrompt = u.input_tokens ?? 0;
              usageCachedRead = u.cache_read_input_tokens ?? 0;
            }
            break;
          }
          case "content_block_start": {
            const idx = json.index ?? 0;
            const cb = json.content_block;
            if (cb?.type === "tool_use") {
              toolUseAcc.set(idx, { id: cb.id, name: cb.name, jsonBuf: "" });
              yield {
                toolCallDelta: { index: idx, id: cb.id, name: cb.name, arguments: "" }
              };
            }
            if (cb?.type === "thinking") {
              yield { thinkingStart: true };
            }
            break;
          }
          case "content_block_delta": {
            const idx = json.index ?? 0;
            const d = json.delta;
            if (!d) break;
            if (d.type === "text_delta" && typeof d.text === "string") {
              yield { delta: d.text };
            } else if (d.type === "thinking_delta" && typeof d.thinking === "string") {
              yield { thinkingDelta: d.thinking };
            } else if (d.type === "input_json_delta" && typeof d.partial_json === "string") {
              const acc = toolUseAcc.get(idx);
              if (acc) acc.jsonBuf += d.partial_json;
              yield {
                toolCallDelta: {
                  index: idx,
                  arguments: d.partial_json
                }
              };
            }
            break;
          }
          case "content_block_stop": {
            break;
          }
          case "message_delta": {
            const reason = json.delta?.stop_reason;
            const u = json.usage;
            if (u) {
              usageCompletion = u.output_tokens ?? usageCompletion;
            }
            if (reason) {
              yield { finishReason: mapStopReason(reason) };
            }
            break;
          }
          case "message_stop": {
            yield {
              usage: {
                promptTokens: usagePrompt,
                completionTokens: usageCompletion,
                cachedPromptTokens: usageCachedRead || void 0
              }
            };
            yield { done: true };
            return;
          }
          case "ping":
          case "error":
          default:
            break;
        }
      }
    }
  }
  // Anthropic 也提供 embeddings，但目前不普及，且 OpenAI/Voyage 是主流 —— 不实现
};
function mapStopReason(r) {
  if (r === "tool_use") return "tool_calls";
  if (r === "end_turn" || r === "stop_sequence") return "stop";
  if (r === "max_tokens") return "length";
  return "stop";
}
function transformMessages(messages, useCache) {
  const out = [];
  for (let i = 0; i < messages.length; i++) {
    const m = messages[i];
    if (m.role === "user") {
      const multimodal = m._multimodal;
      if (multimodal) {
        const blocks = multimodal.map((b) => {
          if (b.type === "text") {
            const block = { type: "text", text: b.text };
            if (useCache && m.cacheHint === "ephemeral") {
              block.cache_control = { type: "ephemeral" };
            }
            return block;
          }
          if (b.type === "image") return { type: "image", source: b.source };
          return b;
        });
        out.push({ role: "user", content: blocks });
      } else {
        const block = { type: "text", text: m.content };
        if (useCache && m.cacheHint === "ephemeral") {
          block.cache_control = { type: "ephemeral" };
        }
        out.push({ role: "user", content: [block] });
      }
    } else if (m.role === "assistant") {
      const blocks = [];
      if (m.content) blocks.push({ type: "text", text: m.content });
      if (m.tool_calls?.length) {
        for (const t of m.tool_calls) {
          blocks.push({
            type: "tool_use",
            id: t.id,
            name: t.name,
            input: t.arguments
          });
        }
      }
      if (blocks.length === 0) blocks.push({ type: "text", text: "" });
      out.push({ role: "assistant", content: blocks });
    } else if (m.role === "tool") {
      const multimodal = m._multimodal;
      const block = {
        type: "tool_result",
        tool_use_id: m.tool_call_id ?? "",
        content: multimodal ? multimodal : m.content
      };
      const prev = out[out.length - 1];
      if (prev?.role === "user" && Array.isArray(prev.content)) {
        const hasOnlyToolResults = prev.content.every((b) => b.type === "tool_result");
        if (hasOnlyToolResults) {
          prev.content.push(block);
          continue;
        }
      }
      out.push({ role: "user", content: [block] });
    }
  }
  return out;
}
function isAnthropicEndpoint(baseUrl) {
  return /\banthropic\.com\b/.test(baseUrl);
}

// ../../packages/core/src/llm/structured.ts
var StructuredCallError = class extends Error {
  constructor(message, attempts, lastRaw) {
    super(message);
    this.attempts = attempts;
    this.lastRaw = lastRaw;
    this.name = "StructuredCallError";
  }
  attempts;
  lastRaw;
};
async function collectFullText(llm, messages, opts) {
  let out = "";
  for await (const chunk of llm.chatStream(messages, {
    model: opts.model,
    temperature: opts.temperature,
    responseFormat: opts.responseFormat,
    signal: opts.signal
  })) {
    if (chunk.delta) out += chunk.delta;
    if (chunk.done || chunk.finishReason) break;
    if (out.length > 32e3) break;
  }
  return out;
}
async function callStructured(llm, opts) {
  const maxRetries = opts.maxRetries ?? 1;
  const schemaJson = zodToJsonSchema(opts.schema);
  const usePromptOnly = opts.forcePromptOnly || llm.name === "anthropic";
  const responseFormat = usePromptOnly ? void 0 : { type: "json_object" };
  const schemaHint = buildSchemaHint(schemaJson, opts.schemaName ?? "output");
  const baseMessages = [...opts.messages];
  const lastSystemIdx = findLastIdx(baseMessages, (m) => m.role === "system");
  if (lastSystemIdx >= 0) {
    baseMessages[lastSystemIdx] = {
      ...baseMessages[lastSystemIdx],
      content: baseMessages[lastSystemIdx].content + "\n\n" + schemaHint
    };
  } else {
    baseMessages.unshift({ role: "system", content: schemaHint });
  }
  let lastErr = null;
  let lastRaw = "";
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const messages = [...baseMessages];
    if (attempt > 0 && lastErr) {
      messages.push({
        role: "user",
        content: `Your previous response could not be parsed as the required JSON schema. Error: ${lastErr}
Output the corrected JSON now, nothing else. Do NOT wrap in markdown code fences.`
      });
    }
    let raw = "";
    try {
      raw = await collectFullText(llm, messages, {
        model: opts.model,
        temperature: opts.temperature ?? 0,
        responseFormat,
        signal: opts.signal
      });
    } catch (e) {
      lastErr = `LLM call failed: ${e?.message ?? e}`;
      lastRaw = "";
      continue;
    }
    lastRaw = raw;
    const jsonText = extractJson(raw);
    if (!jsonText) {
      lastErr = "No JSON object found in output";
      continue;
    }
    let parsedJson;
    try {
      parsedJson = JSON.parse(jsonText);
    } catch (e) {
      lastErr = `JSON parse error: ${e?.message ?? e}`;
      continue;
    }
    const validated = opts.schema.safeParse(parsedJson);
    if (!validated.success) {
      lastErr = `Schema validation failed: ${validated.error.errors.slice(0, 3).map((e) => `${e.path.join(".") || "<root>"}: ${e.message}`).join("; ")}`;
      continue;
    }
    return { data: validated.data, attempts: attempt + 1, raw };
  }
  throw new StructuredCallError(
    `callStructured failed after ${maxRetries + 1} attempts. Last error: ${lastErr ?? "unknown"}`,
    maxRetries + 1,
    lastRaw
  );
}
function buildSchemaHint(schema, name) {
  return `OUTPUT REQUIREMENT \u2014 your response MUST be a valid JSON object matching this schema (no markdown fences, no commentary):
<json_schema name="${name}">
` + JSON.stringify(schema, null, 2) + `
</json_schema>`;
}
function extractJson(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const fenceMatch = trimmed.match(/```(?:json|JSON)?\s*([\s\S]*?)```/);
  if (fenceMatch) return fenceMatch[1].trim();
  if (trimmed.startsWith("{") && trimmed.endsWith("}") || trimmed.startsWith("[") && trimmed.endsWith("]")) {
    return trimmed;
  }
  const startObj = trimmed.indexOf("{");
  const startArr = trimmed.indexOf("[");
  let start = -1;
  let openCh = "";
  let closeCh = "";
  if (startObj >= 0 && (startArr < 0 || startObj < startArr)) {
    start = startObj;
    openCh = "{";
    closeCh = "}";
  } else if (startArr >= 0) {
    start = startArr;
    openCh = "[";
    closeCh = "]";
  } else {
    return null;
  }
  let depth = 0;
  let inStr = false;
  let escape = false;
  for (let i = start; i < trimmed.length; i++) {
    const c = trimmed[i];
    if (escape) {
      escape = false;
      continue;
    }
    if (c === "\\" && inStr) {
      escape = true;
      continue;
    }
    if (c === '"') {
      inStr = !inStr;
      continue;
    }
    if (inStr) continue;
    if (c === openCh) depth++;
    else if (c === closeCh) {
      depth--;
      if (depth === 0) return trimmed.slice(start, i + 1);
    }
  }
  return null;
}
function findLastIdx(arr, pred) {
  for (let i = arr.length - 1; i >= 0; i--) {
    if (pred(arr[i])) return i;
  }
  return -1;
}
function zodToJsonSchema(schema) {
  const def = schema._def;
  if (!def) return { type: "string" };
  switch (def.typeName) {
    case "ZodObject": {
      const shape = typeof def.shape === "function" ? def.shape() : def.shape;
      const properties = {};
      const required = [];
      for (const [k, v] of Object.entries(shape)) {
        properties[k] = zodToJsonSchema(v);
        if (!v.isOptional?.()) required.push(k);
      }
      return { type: "object", properties, required, additionalProperties: false };
    }
    case "ZodString":
      return { type: "string", ...def.description ? { description: def.description } : {} };
    case "ZodNumber":
      return { type: "number", ...def.description ? { description: def.description } : {} };
    case "ZodBoolean":
      return { type: "boolean" };
    case "ZodArray":
      return { type: "array", items: zodToJsonSchema(def.type) };
    case "ZodOptional":
      return zodToJsonSchema(def.innerType);
    case "ZodNullable": {
      const inner = zodToJsonSchema(def.innerType);
      return { ...inner, nullable: true };
    }
    case "ZodDefault":
      return zodToJsonSchema(def.innerType);
    case "ZodEnum":
      return { type: "string", enum: def.values };
    case "ZodLiteral":
      return { const: def.value };
    case "ZodUnion":
      return { anyOf: def.options.map((o) => zodToJsonSchema(o)) };
    case "ZodRecord":
      return { type: "object", additionalProperties: zodToJsonSchema(def.valueType) };
    default:
      return { type: "string" };
  }
}

// ../../packages/core/src/agent/tool-registry.ts
init_zod();
var ToolRegistry = class _ToolRegistry {
  tools = /* @__PURE__ */ new Map();
  register(tool) {
    this.tools.set(tool.name, tool);
    return this;
  }
  unregister(name) {
    this.tools.delete(name);
    return this;
  }
  list() {
    return [...this.tools.values()];
  }
  get(name) {
    return this.tools.get(name);
  }
  toLLMSchemas(substitutions) {
    return this.list().map((t) => {
      let desc = t.description;
      if (substitutions) {
        for (const [k, v] of Object.entries(substitutions)) {
          desc = desc.split(`{${k}}`).join(v);
        }
      }
      return {
        name: t.name,
        description: desc,
        parameters: zodToJsonSchema2(t.schema)
      };
    });
  }
  /**
   * 创建一个仅包含指定 tool 名的子 registry（不深拷贝 tool 本身）。
   * 用于 Agents Window 的 Work 模式（只暴露读类工具）。
   * - names 中找不到的名字会被忽略
   * - 共享同一份 tool 实例（execute 行为完全一致）
   */
  filter(names) {
    const sub = new _ToolRegistry();
    for (const n of names) {
      const t = this.tools.get(n);
      if (t) sub.register(t);
    }
    return sub;
  }
  /** 预设：只读 / 通用咨询 用的精简 profile */
  static CHAT_ONLY_PROFILE = [
    "read_file",
    "list_files",
    "grep_search",
    "find_symbol",
    "search_web"
  ];
  async execute(name, rawArgs, ctx) {
    const tool = this.tools.get(name);
    if (!tool) throw new Error(`Tool not found: ${name}`);
    const parsed = tool.schema.safeParse(rawArgs);
    if (!parsed.success) {
      throw new Error(`Tool ${name} args invalid: ${parsed.error.message}`);
    }
    if (tool.requiresApproval && ctx.approve) {
      const ok = await ctx.approve({ tool: name, args: parsed.data });
      if (!ok) throw new Error(`User rejected tool: ${name}`);
    }
    return tool.execute(parsed.data, ctx);
  }
};
function zodToJsonSchema2(schema) {
  const def = schema._def;
  if (def.typeName === "ZodObject") {
    const shape = def.shape();
    const properties = {};
    const required = [];
    for (const [k, v] of Object.entries(shape)) {
      properties[k] = zodToJsonSchema2(v);
      if (!v.isOptional?.()) required.push(k);
    }
    return { type: "object", properties, required };
  }
  if (def.typeName === "ZodString") return { type: "string", description: def.description };
  if (def.typeName === "ZodNumber") return { type: "number", description: def.description };
  if (def.typeName === "ZodBoolean") return { type: "boolean", description: def.description };
  if (def.typeName === "ZodArray") return { type: "array", items: zodToJsonSchema2(def.type) };
  if (def.typeName === "ZodOptional") return zodToJsonSchema2(def.innerType);
  if (def.typeName === "ZodDefault") return zodToJsonSchema2(def.innerType);
  if (def.typeName === "ZodEnum") return { type: "string", enum: def.values };
  return { type: "string" };
}

// ../../packages/core/src/context/hard-compact.ts
function isContextOverflow(err) {
  const s = err && typeof err === "object" && "message" in err ? String(err.message) : String(err ?? "");
  if (!s) return false;
  return /context[_\s]?length[_\s]?exceeded/i.test(s) || /maximum context length/i.test(s) || /prompt.*too long/i.test(s) || /context.*too long/i.test(s) || /context.*limit/i.test(s) || /reduce.*length.*messages/i.test(s) || /token.*limit/i.test(s);
}
function hardCompact(messages, opts = {}) {
  const keepLast = opts.keepLast ?? 3;
  const keepStable = opts.keepStable !== false;
  const stableHead = [];
  let cursor = 0;
  if (keepStable) {
    while (cursor < messages.length && messages[cursor].role === "system") {
      stableHead.push(messages[cursor]);
      cursor++;
    }
  }
  const tail = [];
  let userAsstCount = 0;
  for (let i = messages.length - 1; i >= cursor; i--) {
    const m = messages[i];
    if (m.role === "user" || m.role === "assistant") {
      tail.unshift(m);
      userAsstCount++;
      if (userAsstCount >= keepLast) break;
    }
    if (m.role === "tool") tail.unshift(m);
  }
  const middleEnd = messages.length - tail.length;
  const middle = messages.slice(cursor, middleEnd);
  const summary = summarizeHard(middle);
  const summaryMsg = {
    role: "system",
    content: `[HARD-COMPACT] Context overflow occurred \u2014 ${middle.length} earlier messages have been collapsed into the summary below. Tool call details have been lost.
` + summary + `
(Do NOT try to read those earlier tool outputs again; if needed, re-run the tool with current context.)`
  };
  while (tail.length > 0 && tail[0].role === "tool") tail.shift();
  return [...stableHead, summaryMsg, ...tail];
}
function summarizeHard(middle) {
  if (middle.length === 0) return "(no middle content)";
  const paths = /* @__PURE__ */ new Set();
  const tools = /* @__PURE__ */ new Map();
  const errors = [];
  const decisions = [];
  const decisionPatterns = [
    /I(?:'ll| will| need to| should| decided to| plan to| think)\b[^\n.]{5,120}/gi,
    /let me\b[^\n.]{5,120}/gi,
    /(?:决定|接下来|需要|应该|打算|计划|先|然后|因此)[^\n。]{3,80}/g,
    /(?:based on|because|the issue is|the problem|root cause)[^\n.]{5,120}/gi
  ];
  for (const m of middle) {
    const txt = (m.content ?? "").toString();
    for (const p of txt.matchAll(/[\w./-]+\.[a-zA-Z]{1,5}\b/g)) {
      if (paths.size < 40) paths.add(p[0]);
    }
    if (m.role === "tool" && m.name) {
      tools.set(m.name, (tools.get(m.name) ?? 0) + 1);
    }
    if (m.role === "assistant" && m.tool_calls) {
      for (const tc of m.tool_calls) {
        tools.set(tc.name, (tools.get(tc.name) ?? 0) + 1);
      }
    }
    for (const e of txt.matchAll(/(?:Error|error|failed|exception)[:\s][^\n]{0,180}/gi)) {
      if (errors.length < 5) errors.push(e[0].slice(0, 180));
    }
    if (m.role === "assistant" && txt.length > 10) {
      let matchedInThisMsg = false;
      for (const pattern of decisionPatterns) {
        for (const match of txt.matchAll(pattern)) {
          if (decisions.length < 5) {
            decisions.push(match[0].trim().slice(0, 120));
            matchedInThisMsg = true;
          }
        }
        if (decisions.length >= 5) break;
      }
      if (decisions.length < 5 && !matchedInThisMsg) {
        const firstSentence = txt.split(/[.\n。]/)[0]?.trim();
        if (firstSentence && firstSentence.length > 8 && firstSentence.length < 120) {
          if (!firstSentence.startsWith("```") && !firstSentence.startsWith("~~~")) {
            decisions.push(firstSentence);
          }
        }
      }
    }
  }
  const lines = [];
  lines.push(`Compacted ${middle.length} messages.`);
  if (decisions.length) {
    lines.push(`Key decisions/reasoning:
  - ${decisions.join("\n  - ")}`);
  }
  if (tools.size) {
    const sorted = [...tools.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8);
    lines.push(`Tool usage: ${sorted.map(([n, c]) => `${n}\xD7${c}`).join(", ")}`);
  }
  if (paths.size) {
    lines.push(`Files touched: ${[...paths].slice(0, 25).join(", ")}`);
  }
  if (errors.length) {
    lines.push(`Errors seen:
  - ${errors.join("\n  - ")}`);
  }
  return lines.join("\n");
}

// ../../packages/core/src/context/soft-compact.ts
import * as fs from "node:fs";
import * as path from "node:path";
import * as crypto from "node:crypto";
var DEFAULT_OPTS = {
  maxMessages: 60,
  keepHead: 3,
  keepRecentToolResults: 3,
  microMinChars: 400,
  spillThresholdBytes: 4 * 1024
  // 4KB — aggressive spill to preserve context for long ReAct loops
};
function snipCompact(messages, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  if (messages.length <= o.maxMessages) return messages;
  const keepTail = o.maxMessages - o.keepHead;
  const head = messages.slice(0, o.keepHead);
  const tail = messages.slice(messages.length - keepTail);
  while (tail.length && tail[0].role === "tool") tail.shift();
  const snipped = messages.length - head.length - tail.length;
  if (snipped <= 0) return messages;
  const placeholder = {
    role: "system",
    content: `[snipped ${snipped} earlier messages from conversation middle to keep context under control]`
  };
  return [...head, placeholder, ...tail];
}
function microCompact(messages, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const toolIdx = [];
  for (let i = 0; i < messages.length; i++) {
    if (messages[i].role === "tool") toolIdx.push(i);
  }
  if (toolIdx.length <= o.keepRecentToolResults) return messages;
  const compactSet = new Set(toolIdx.slice(0, toolIdx.length - o.keepRecentToolResults));
  return messages.map((m, i) => {
    if (!compactSet.has(i)) return m;
    if (m.role !== "tool") return m;
    const len = (m.content ?? "").length;
    if (len < o.microMinChars) return m;
    return {
      ...m,
      content: `[Earlier tool result compacted (${len} chars). Re-run the tool with current context if you need it again.]`
    };
  });
}
function spillLargeToolResults(messages, opts = {}) {
  const o = { ...DEFAULT_OPTS, ...opts };
  const ws = opts.workspace;
  if (!ws) return messages;
  const cacheDir = path.join(ws, ".minicodeide", "tool-cache");
  let dirReady = false;
  return messages.map((m) => {
    if (m.role !== "tool") return m;
    const content = m.content ?? "";
    const bytes = Buffer.byteLength(content, "utf8");
    if (bytes < o.spillThresholdBytes) return m;
    if (!dirReady) {
      try {
        fs.mkdirSync(cacheDir, { recursive: true });
        dirReady = true;
      } catch {
        return m;
      }
    }
    const hash = crypto.createHash("sha1").update(content).digest("hex").slice(0, 12);
    const file = path.join(cacheDir, `${hash}.txt`);
    try {
      if (!fs.existsSync(file)) fs.writeFileSync(file, content, "utf8");
    } catch {
      return m;
    }
    const rel = path.relative(ws, file).replace(/\\/g, "/");
    const head = content.slice(0, 400).replace(/\s+/g, " ");
    return {
      ...m,
      content: `[large tool result spilled to disk: ${rel} (${bytes} bytes)]
Preview: ${head}...
If you need the full content, call read_file with path="${rel}".`
    };
  });
}
function compactPipeline(messages, opts = {}) {
  let m = messages;
  m = spillLargeToolResults(m, opts);
  m = microCompact(m, opts);
  m = snipCompact(m, opts);
  return m;
}

// ../../packages/core/src/agent/loop.ts
import * as fs2 from "node:fs";
import * as path2 from "node:path";
import * as crypto2 from "node:crypto";

// ../../packages/core/src/agent/error-recovery.ts
var ESCALATED_MAX_TOKENS = 64e3;
var MAX_CONTINUATION_RETRIES = 3;
var MAX_BACKOFF_ATTEMPTS = 5;
function createRecoveryState() {
  return {
    hasEscalatedMaxTokens: false,
    continuationCount: 0,
    hasAttemptedReactiveCompact: false,
    backoffAttempts: 0
  };
}
function classifyError(err, finishReason) {
  if (finishReason === "length") return "max_tokens";
  const msg = err && typeof err === "object" && "message" in err ? String(err.message) : String(err ?? "");
  const status = err && typeof err === "object" && "status" in err ? Number(err.status) : 0;
  if (status === 429 || /rate.?limit|too many requests/i.test(msg)) return "rate_limit";
  if (status === 529 || status === 503 || /overloaded|service unavailable/i.test(msg)) return "overloaded";
  if (status === 401 || status === 403 || /unauthorized|invalid.*api.*key|authentication/i.test(msg)) return "auth";
  if (/timeout|timed out|ETIMEDOUT|ECONNRESET/i.test(msg)) return "timeout";
  if (/context[_\s]?length[_\s]?exceeded/i.test(msg) || /maximum context length/i.test(msg) || /prompt.*too long/i.test(msg) || /context.*too long/i.test(msg) || /context.*limit/i.test(msg) || /reduce.*length.*messages/i.test(msg) || /token.*limit/i.test(msg)) return "prompt_too_long";
  return "unknown";
}
function computeBackoff(attempt) {
  const base = 1e3 * Math.pow(2, Math.min(attempt, 4));
  const jitter = base * 0.2 * (Math.random() * 2 - 1);
  return Math.max(500, Math.floor(base + jitter));
}
function decideTruncatedAction(state) {
  if (!state.hasEscalatedMaxTokens) {
    state.hasEscalatedMaxTokens = true;
    return { kind: "truncated_escalate", nextMaxTokens: ESCALATED_MAX_TOKENS };
  }
  if (state.continuationCount < MAX_CONTINUATION_RETRIES) {
    state.continuationCount++;
    return {
      kind: "truncated_continue",
      injectMessage: "Output token limit hit. Resume directly from where you stopped \u2014 no apology, no recap. Pick up mid-thought."
    };
  }
  return { kind: "fatal", reason: "max_tokens still truncated after 3 continuations; bailing out." };
}
function decideOverflowAction(state) {
  if (!state.hasAttemptedReactiveCompact) {
    state.hasAttemptedReactiveCompact = true;
    return { kind: "overflow_compact" };
  }
  return { kind: "fatal", reason: "context still overflowing after reactive compact." };
}
function decideBackoffAction(state, classified) {
  state.backoffAttempts++;
  if (state.backoffAttempts > MAX_BACKOFF_ATTEMPTS) {
    return { kind: "fatal", reason: `${classified}: exceeded ${MAX_BACKOFF_ATTEMPTS} retries` };
  }
  const switchModel = classified === "overloaded" && state.backoffAttempts >= 3;
  return {
    kind: "backoff",
    delayMs: computeBackoff(state.backoffAttempts - 1),
    attempt: state.backoffAttempts,
    switchModel
  };
}

// ../../packages/core/src/agent/loop.ts
async function* runAgent(opts) {
  const {
    llm,
    registry,
    messages,
    toolCtx,
    maxSteps = 25,
    model,
    signal,
    hooks,
    workspace,
    disableSoftCompact,
    toolDescSubstitutions,
    llmTimeout
  } = opts;
  const tools = registry.toLLMSchemas(toolDescSubstitutions);
  const recentSigs = [];
  const toolErrorCount = {};
  const TOOL_ERROR_BUDGET = 3;
  const recovery = createRecoveryState();
  if (hooks) {
    const lastUser = [...messages].reverse().find((m) => m.role === "user");
    if (lastUser) {
      const r = await hooks.triggerUserPromptSubmit({
        userText: lastUser.content ?? "",
        messages
      });
      if (r.block) {
        yield { type: "error", error: `[hook-block] ${r.blockReason ?? "blocked"}` };
        yield { type: "done", reason: "hook_block" };
        return;
      }
      if (r.injectSystem) {
        messages.push({ role: "system", content: r.injectSystem });
      }
    }
  }
  for (let step = 0; step < maxSteps; step++) {
    if (!disableSoftCompact) {
      const before = messages.length;
      const compacted = compactPipeline(messages, { workspace });
      if (compacted !== messages && compacted.length !== before) {
        messages.splice(0, messages.length, ...compacted);
      } else if (compacted !== messages) {
        messages.splice(0, messages.length, ...compacted);
      }
    }
    let textBuf = "";
    let finishReason;
    const toolBuffers = {};
    let stream;
    let llmCallOk = false;
    while (!llmCallOk) {
      try {
        stream = llm.chatStream(messages, { tools, model, signal, ...llmTimeout });
        const it = stream[Symbol.asyncIterator]();
        const first = await it.next();
        stream = (async function* () {
          if (!first.done) yield first.value;
          while (true) {
            const { value, done } = await it.next();
            if (done) return;
            yield value;
          }
        })();
        llmCallOk = true;
      } catch (e) {
        const cls = classifyError(e);
        if (cls === "prompt_too_long" || isContextOverflow(e)) {
          const action = decideOverflowAction(recovery);
          if (action.kind === "fatal") {
            yield { type: "error", error: `[fatal] ${action.reason}` };
            yield { type: "done", reason: "fatal", step };
            return;
          }
          const before = messages.length;
          const compacted = hardCompact(messages, { keepLast: 3 });
          messages.splice(0, messages.length, ...compacted);
          yield {
            type: "error",
            error: `[reactive-compact] context overflow; collapsed ${before - messages.length} messages and retrying.`
          };
          continue;
        }
        if (cls === "rate_limit" || cls === "overloaded" || cls === "timeout") {
          const action = decideBackoffAction(recovery, cls);
          if (action.kind === "fatal") {
            yield { type: "error", error: `[fatal] ${action.reason}` };
            yield { type: "done", reason: "fatal", step };
            return;
          }
          if (action.kind === "backoff") {
            yield {
              type: "error",
              error: `[backoff] ${cls}; waiting ${action.delayMs}ms (attempt ${action.attempt})${action.switchModel ? " (switch-model hint)" : ""}`
            };
            await sleep(action.delayMs, signal);
            continue;
          }
        }
        throw e;
      }
    }
    try {
      for await (const chunk of stream) {
        if (chunk.delta) {
          textBuf += chunk.delta;
          yield { type: "text", text: chunk.delta };
        }
        if (chunk.toolCallDelta) {
          const i = chunk.toolCallDelta.index ?? 0;
          const slot = toolBuffers[i] ??= { args: "" };
          if (chunk.toolCallDelta.id) slot.id = chunk.toolCallDelta.id;
          if (chunk.toolCallDelta.name) slot.name = chunk.toolCallDelta.name;
          if (typeof chunk.toolCallDelta.arguments === "string") {
            slot.args += chunk.toolCallDelta.arguments;
          }
        }
        if (chunk.usage) {
          yield { type: "usage", usage: chunk.usage };
        }
        if (chunk.finishReason) finishReason = chunk.finishReason;
        if (chunk.done || chunk.finishReason) break;
      }
    } catch (e) {
      yield { type: "error", error: `[stream-error] ${e?.message ?? e}` };
      yield { type: "done", reason: "stream_error", step };
      return;
    }
    const toolCalls = Object.values(toolBuffers).filter((b) => b.name).map((b, idx) => ({
      id: b.id ?? `call_${Date.now()}_${idx}`,
      name: b.name,
      arguments: safeJSONParse(b.args)
    }));
    const assistantMsg = {
      role: "assistant",
      content: textBuf,
      ...toolCalls.length ? { tool_calls: toolCalls } : {}
    };
    if (finishReason === "length" && !toolCalls.length) {
      const action = decideTruncatedAction(recovery);
      if (action.kind === "truncated_escalate") {
        yield {
          type: "error",
          error: `[truncated-escalate] hit max_tokens; retrying with larger budget (${action.nextMaxTokens})`
        };
        continue;
      }
      if (action.kind === "truncated_continue") {
        messages.push(assistantMsg);
        messages.push({ role: "user", content: action.injectMessage });
        yield { type: "error", error: "[truncated-continue] resume directly" };
        continue;
      }
      if (action.kind === "fatal") {
        messages.push(assistantMsg);
        yield { type: "error", error: `[fatal] ${action.reason}` };
        await maybeStop(hooks, "error", step, messages);
        yield { type: "done", reason: "fatal", step };
        return;
      }
    }
    messages.push(assistantMsg);
    if (!toolCalls.length) {
      if (hooks) {
        const r = await hooks.triggerStop({ reason: "done", step, messages });
        if (r.forceContinue && r.injectUserMessage) {
          messages.push({ role: "user", content: r.injectUserMessage });
          continue;
        }
      }
      yield { type: "done", reason: "completed", step };
      return;
    }
    const sig = toolCalls.map((c) => `${c.name}::${stableStringify(c.arguments)}`).sort().join("|");
    recentSigs.push(sig);
    if (recentSigs.length > 3) recentSigs.shift();
    if (recentSigs.length === 3 && recentSigs[0] === recentSigs[1] && recentSigs[1] === recentSigs[2]) {
      const brake = "[loop-breaker] You have called the same tool(s) with identical arguments for 3 consecutive turns. STOP and use the `think` tool to reconsider strategy.";
      messages.push({ role: "system", content: brake });
      yield { type: "error", error: brake };
      recentSigs.length = 0;
    }
    const segments = [];
    let buf = [];
    for (const call of toolCalls) {
      const t = registry.get(call.name);
      const safe = !!t?.parallelSafe;
      if (safe) {
        buf.push(call);
      } else {
        if (buf.length) segments.push(buf);
        segments.push([call]);
        buf = [];
      }
    }
    if (buf.length) segments.push(buf);
    for (const seg of segments) {
      const settled = await Promise.all(
        seg.map(async (call) => {
          const t0 = Date.now();
          if (hooks) {
            const r = await hooks.triggerPreToolUse({ call, step });
            if (r.block) {
              const dur = Date.now() - t0;
              await hooks.triggerPostToolUse({
                call,
                ok: false,
                error: r.blockReason ?? "blocked by hook",
                step,
                durationMs: dur
              });
              return { call, ok: false, error: r.blockReason ?? "blocked by hook" };
            }
            if (r.rewriteArguments) call.arguments = r.rewriteArguments;
          }
          try {
            const result = await registry.execute(call.name, call.arguments, toolCtx);
            const dur = Date.now() - t0;
            if (hooks) {
              await hooks.triggerPostToolUse({ call, ok: true, result, step, durationMs: dur });
            }
            return { call, ok: true, result };
          } catch (e) {
            const dur = Date.now() - t0;
            const errMsg = e?.message ?? String(e);
            if (hooks) {
              await hooks.triggerPostToolUse({ call, ok: false, error: errMsg, step, durationMs: dur });
            }
            return { call, ok: false, error: errMsg };
          }
        })
      );
      for (const s of settled) {
        yield { type: "tool_call", toolCall: s.call };
        if (s.ok) {
          toolErrorCount[s.call.name] = 0;
          let resultContent = typeof s.result === "string" ? s.result : JSON.stringify(s.result);
          const resultBytes = Buffer.byteLength(resultContent, "utf8");
          const SPILL_THRESHOLD = 4 * 1024;
          if (workspace && resultBytes >= SPILL_THRESHOLD) {
            const spillDir = path2.join(workspace, ".minicodeide", "spill");
            try {
              fs2.mkdirSync(spillDir, { recursive: true });
              const hash = crypto2.createHash("sha1").update(resultContent).digest("hex").slice(0, 12);
              const spillFile = path2.join(spillDir, `${s.call.name}-${hash}.txt`);
              if (!fs2.existsSync(spillFile)) fs2.writeFileSync(spillFile, resultContent, "utf8");
              const rel = path2.relative(workspace, spillFile).replace(/\\/g, "/");
              const head = resultContent.slice(0, 400).replace(/\s+/g, " ");
              resultContent = `[large tool result spilled to disk: ${rel} (${resultBytes} bytes)]
Preview: ${head}...
If you need the full content, call read_file with path="${rel}".`;
              yield {
                type: "tool_result",
                toolCall: s.call,
                toolResult: resultContent,
                spilledTo: rel
              };
            } catch {
              yield { type: "tool_result", toolCall: s.call, toolResult: s.result };
            }
          } else {
            yield { type: "tool_result", toolCall: s.call, toolResult: s.result };
          }
          const imgData = s.result?.__image;
          if (imgData && imgData.type === "image") {
            messages.push({
              role: "tool",
              tool_call_id: s.call.id,
              name: s.call.name,
              content: resultContent,
              // multimodal 扩展：provider 适配层会读取这个字段
              _multimodal: [
                { type: "text", text: resultContent },
                {
                  type: "image",
                  source: {
                    type: "base64",
                    media_type: imgData.media_type,
                    data: imgData.data
                  }
                }
              ]
            });
          } else {
            messages.push({
              role: "tool",
              tool_call_id: s.call.id,
              name: s.call.name,
              content: resultContent
            });
          }
        } else {
          toolErrorCount[s.call.name] = (toolErrorCount[s.call.name] ?? 0) + 1;
          yield { type: "error", error: s.error, toolCall: s.call };
          const cnt = toolErrorCount[s.call.name];
          let extraHint = "";
          if (cnt >= TOOL_ERROR_BUDGET) {
            extraHint = `

[tool-budget] \`${s.call.name}\` has failed ${cnt} times in a row in this run; STOP retrying it with the same approach. Either:
  (a) call \`think\` to analyze why, then try a DIFFERENT tool / different args, OR
  (b) explain the blocker to the user and stop.`;
          }
          messages.push({
            role: "tool",
            tool_call_id: s.call.id,
            name: s.call.name,
            content: `ERROR: ${s.error}${extraHint}`
          });
        }
      }
    }
  }
  if (hooks) {
    const r = await hooks.triggerStop({ reason: "max_steps", step: maxSteps, messages });
    if (r.forceContinue && r.injectUserMessage) {
      yield { type: "error", error: "[max-steps] reached but Stop hook requested forceContinue (ignored to prevent runaway)." };
    }
  }
  yield {
    type: "text",
    text: `

\u26A0\uFE0F \u5DF2\u8FBE\u5230\u6700\u5927\u6B65\u9AA4\u6570 (${maxSteps})\uFF0C\u6267\u884C\u6682\u505C\u3002\u5982\u9700\u7EE7\u7EED\uFF0C\u8BF7\u518D\u6B21\u53D1\u9001\u6D88\u606F\u3002`
  };
  yield { type: "done", reason: "max_steps", step: maxSteps };
}
async function maybeStop(hooks, reason, step, messages) {
  if (!hooks) return;
  await hooks.triggerStop({ reason, step, messages });
}
function safeJSONParse(s) {
  try {
    return JSON.parse(s || "{}");
  } catch {
    return {};
  }
}
function stableStringify(v) {
  if (v === null || typeof v !== "object") return JSON.stringify(v);
  if (Array.isArray(v)) return "[" + v.map(stableStringify).join(",") + "]";
  const keys = Object.keys(v).sort();
  return "{" + keys.map((k) => JSON.stringify(k) + ":" + stableStringify(v[k])).join(",") + "}";
}
function sleep(ms, signal) {
  return new Promise((resolve3, reject) => {
    if (signal?.aborted) return reject(new Error("aborted"));
    const t = setTimeout(() => resolve3(), ms);
    signal?.addEventListener("abort", () => {
      clearTimeout(t);
      reject(new Error("aborted"));
    });
  });
}

// ../../packages/core/src/agent/builtin-tools.ts
init_zod();
import { promises as fs6 } from "node:fs";
import path6 from "node:path";
import { execFile as execFile2 } from "node:child_process";
import { promisify as promisify2 } from "node:util";

// ../../packages/core/src/agent/fuzzy-apply.ts
function fuzzyApply(source, oldString, newString, opts = {}) {
  if (oldString === "") {
    return { ok: false, reason: "oldString is empty" };
  }
  {
    const i = source.indexOf(oldString);
    if (i !== -1) {
      const next = applyAt(source, i, oldString.length, newString, oldString, opts);
      const final = opts.replaceAll ? source.split(oldString).join(rebase(newString, oldString, opts)) : next;
      return { ok: true, next: final, strategy: "exact", range: [i, i + oldString.length] };
    }
  }
  {
    const r = matchTrimLine(source, oldString);
    if (r) {
      const slice = source.slice(r[0], r[1]);
      const next = applyAt(source, r[0], slice.length, newString, slice, opts);
      return { ok: true, next, strategy: "trim-line", range: r };
    }
  }
  {
    const r = matchWsCollapse(source, oldString);
    if (r) {
      const slice = source.slice(r[0], r[1]);
      const next = applyAt(source, r[0], slice.length, newString, slice, opts);
      return { ok: true, next, strategy: "ws-collapse", range: r };
    }
  }
  {
    const r = matchLineAnchor(source, oldString);
    if (r) {
      const slice = source.slice(r[0], r[1]);
      const next = applyAt(source, r[0], slice.length, newString, slice, opts);
      return { ok: true, next, strategy: "line-anchor", range: r };
    }
  }
  return { ok: false, reason: "oldString not found, even with fuzzy match" };
}
function applyAt(source, start, len, newString, hitSlice, opts) {
  const replacement = rebase(newString, hitSlice, opts);
  return source.slice(0, start) + replacement + source.slice(start + len);
}
function rebase(newString, hitSlice, opts) {
  if (opts.rebaseIndent === false) return newString;
  const hitIndent = leadingWS(firstLine(hitSlice));
  const newIndent = leadingWS(firstLine(newString));
  if (hitIndent === newIndent) return newString;
  const lines = newString.split("\n");
  let minNewIndent = Infinity;
  for (const ln of lines) {
    if (ln.trim() === "") continue;
    const ws = leadingWS(ln);
    if (ws.length < minNewIndent) minNewIndent = ws.length;
  }
  if (!isFinite(minNewIndent)) minNewIndent = 0;
  return lines.map((ln) => {
    if (ln.trim() === "") return ln;
    return hitIndent + ln.slice(minNewIndent);
  }).join("\n");
}
function firstLine(s) {
  const i = s.indexOf("\n");
  return i === -1 ? s : s.slice(0, i);
}
function leadingWS(line) {
  const m = line.match(/^[ \t]*/);
  return m ? m[0] : "";
}
function matchTrimLine(source, needle) {
  const norm = (s) => s.split("\n").map((l) => l.replace(/[ \t]+$/g, "")).join("\n");
  const ns = norm(source);
  const nn = norm(needle);
  const i = ns.indexOf(nn);
  if (i === -1) return null;
  return mapNormalizedRangeBack(source, ns, i, nn.length);
}
function matchWsCollapse(source, needle) {
  const collapse = (s) => s.replace(/\s+/g, " ").trim();
  const ns = collapse(source);
  const nn = collapse(needle);
  if (!nn.length) return null;
  const i = ns.indexOf(nn);
  if (i === -1) return null;
  return locateByCollapsed(source, i, nn.length);
}
function matchLineAnchor(source, needle) {
  const sLines = source.split("\n");
  const nLines = needle.split("\n").map((l) => l.trim()).filter((_, i, arr) => !(i === arr.length - 1 && _ === ""));
  if (!nLines.length) return null;
  const trimmedSrc = sLines.map((l) => l.trim());
  for (let i = 0; i + nLines.length <= trimmedSrc.length; i++) {
    let ok = true;
    for (let j = 0; j < nLines.length; j++) {
      if (trimmedSrc[i + j] !== nLines[j]) {
        ok = false;
        break;
      }
    }
    if (ok) {
      let start = 0;
      for (let k = 0; k < i; k++) start += sLines[k].length + 1;
      let end = start;
      for (let k = 0; k < nLines.length; k++) end += sLines[i + k].length + (k === nLines.length - 1 ? 0 : 1);
      return [start, end];
    }
  }
  return null;
}
function mapNormalizedRangeBack(raw, normalized, start, len) {
  let ri = 0;
  let ni = 0;
  let mappedStart = -1;
  let mappedEnd = -1;
  const isEOLws = (i) => {
    if (raw[i] !== " " && raw[i] !== "	") return false;
    let j = i;
    while (j < raw.length && (raw[j] === " " || raw[j] === "	")) j++;
    return j === raw.length || raw[j] === "\n";
  };
  while (ri < raw.length && ni <= start + len) {
    if (isEOLws(ri)) {
      ri++;
      continue;
    }
    if (ni === start) mappedStart = ri;
    if (ni === start + len) {
      mappedEnd = ri;
      break;
    }
    ri++;
    ni++;
  }
  if (mappedStart < 0) return null;
  if (mappedEnd < 0) mappedEnd = ri;
  return [mappedStart, mappedEnd];
}
function locateByCollapsed(source, collapsedStart, collapsedLen) {
  let ri = 0;
  while (ri < source.length && /\s/.test(source[ri])) ri++;
  let ci = 0;
  let mappedStart = -1;
  let mappedEnd = -1;
  let lastWasWS = false;
  while (ri < source.length) {
    const ch = source[ri];
    if (/\s/.test(ch)) {
      if (!lastWasWS) {
        if (ci === collapsedStart) mappedStart = ri;
        if (ci === collapsedStart + collapsedLen) {
          mappedEnd = ri;
          break;
        }
        ci++;
        lastWasWS = true;
      }
    } else {
      if (ci === collapsedStart) mappedStart = ri;
      if (ci === collapsedStart + collapsedLen) {
        mappedEnd = ri;
        break;
      }
      ci++;
      lastWasWS = false;
    }
    ri++;
  }
  if (mappedStart < 0) return null;
  if (mappedEnd < 0) mappedEnd = ri;
  return [mappedStart, mappedEnd];
}

// ../../packages/core/src/agent/web-fetch-tool.ts
init_zod();
var CACHE = /* @__PURE__ */ new Map();
var CACHE_TTL_MS = 15 * 60 * 1e3;
var CACHE_MAX = 128;
var MAX_CONTENT_BYTES = 30 * 1024;
var MAX_REDIRECTS = 5;
function cacheGet(url) {
  const e = CACHE.get(url);
  if (!e) return null;
  if (Date.now() - e.at > CACHE_TTL_MS) {
    CACHE.delete(url);
    return null;
  }
  return e;
}
function cachePut(url, val) {
  if (CACHE.size >= CACHE_MAX) {
    const oldestKey = CACHE.keys().next().value;
    if (oldestKey) CACHE.delete(oldestKey);
  }
  CACHE.set(url, { at: Date.now(), ...val });
}
function ensureSafeUrl(raw) {
  let u;
  try {
    u = new URL(raw);
  } catch {
    return { ok: false, reason: "Malformed URL" };
  }
  if (u.protocol !== "http:" && u.protocol !== "https:") {
    return { ok: false, reason: `Disallowed protocol: ${u.protocol}` };
  }
  const host = u.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host)) {
    const octets = host.split(".").map(Number);
    if (octets.some((o) => o > 255)) {
      return { ok: false, reason: "Invalid IP address" };
    }
    if (octets[0] === 127) {
      return { ok: false, reason: "Disallowed host: loopback" };
    }
    if (octets[0] === 10) {
      return { ok: false, reason: "Disallowed host: private network (10.0.0.0/8)" };
    }
    if (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31) {
      return { ok: false, reason: "Disallowed host: private network (172.16.0.0/12)" };
    }
    if (octets[0] === 192 && octets[1] === 168) {
      return { ok: false, reason: "Disallowed host: private network (192.168.0.0/16)" };
    }
    if (octets[0] === 169 && octets[1] === 254) {
      return { ok: false, reason: "Disallowed host: link-local / cloud metadata" };
    }
    if (octets[0] === 0 && octets[1] === 0 && octets[2] === 0 && octets[3] === 0) {
      return { ok: false, reason: "Disallowed host: 0.0.0.0" };
    }
  }
  if (host === "[::1]" || host === "::1") {
    return { ok: false, reason: "Disallowed host: IPv6 loopback" };
  }
  if (host === "localhost" || host === "0.0.0.0" || host.endsWith(".local") || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".arpa")) {
    return { ok: false, reason: "Disallowed host: loopback / local / internal" };
  }
  return { ok: true, url: u };
}
async function ensureSafeDns(url) {
  const host = url.hostname.toLowerCase();
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(host) || /^\[?[0-9a-f:]+\]?$/i.test(host)) {
    return { ok: true };
  }
  try {
    const { lookup } = await import("dns");
    return new Promise((resolve3) => {
      lookup(host, (err, address) => {
        if (err) {
          resolve3({ ok: true });
          return;
        }
        const safe = ensureSafeUrl(`http://${address}`);
        if (!safe.ok) {
          resolve3({ ok: false, reason: `DNS resolved to blocked address: ${safe.reason}` });
          return;
        }
        resolve3({ ok: true });
      });
    });
  } catch {
    return { ok: true };
  }
}
function htmlToMarkdown(html) {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const title = (titleMatch?.[1] ?? "").replace(/\s+/g, " ").trim();
  let s = html.replace(/<script[\s\S]*?<\/script>/gi, "").replace(/<style[\s\S]*?<\/style>/gi, "").replace(/<noscript[\s\S]*?<\/noscript>/gi, "").replace(/<svg[\s\S]*?<\/svg>/gi, "").replace(/<iframe[\s\S]*?<\/iframe>/gi, "").replace(/<nav[\s\S]*?<\/nav>/gi, "").replace(/<footer[\s\S]*?<\/footer>/gi, "").replace(/<aside[\s\S]*?<\/aside>/gi, "").replace(/<header[\s\S]*?<\/header>/gi, "").replace(/<form[\s\S]*?<\/form>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  const main2 = s.match(/<main[^>]*>([\s\S]*?)<\/main>/i)?.[1] ?? s.match(/<article[^>]*>([\s\S]*?)<\/article>/i)?.[1] ?? s.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? s;
  s = main2;
  s = s.replace(/<h1[^>]*>([\s\S]*?)<\/h1>/gi, "\n\n# $1\n\n").replace(/<h2[^>]*>([\s\S]*?)<\/h2>/gi, "\n\n## $1\n\n").replace(/<h3[^>]*>([\s\S]*?)<\/h3>/gi, "\n\n### $1\n\n").replace(/<h4[^>]*>([\s\S]*?)<\/h4>/gi, "\n\n#### $1\n\n").replace(/<h5[^>]*>([\s\S]*?)<\/h5>/gi, "\n\n##### $1\n\n").replace(/<h6[^>]*>([\s\S]*?)<\/h6>/gi, "\n\n###### $1\n\n").replace(/<pre[^>]*><code[^>]*>([\s\S]*?)<\/code><\/pre>/gi, "\n```\n$1\n```\n").replace(/<pre[^>]*>([\s\S]*?)<\/pre>/gi, "\n```\n$1\n```\n").replace(/<code[^>]*>([\s\S]*?)<\/code>/gi, "`$1`").replace(/<li[^>]*>([\s\S]*?)<\/li>/gi, "\n- $1").replace(/<\/(ul|ol)>/gi, "\n").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n\n").replace(/<a [^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, "[$2]($1)").replace(/<strong[^>]*>([\s\S]*?)<\/strong>/gi, "**$1**").replace(/<b[^>]*>([\s\S]*?)<\/b>/gi, "**$1**").replace(/<em[^>]*>([\s\S]*?)<\/em>/gi, "*$1*").replace(/<i[^>]*>([\s\S]*?)<\/i>/gi, "*$1*").replace(/<[^>]+>/g, "").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/[ \t]+/g, " ").replace(/\n{3,}/g, "\n\n").trim();
  return { title, markdown: s };
}
var webFetchTool = {
  name: "web_fetch",
  description: `Fetch a public web page (docs / RFC / Stack Overflow / GitHub README / npm page) and return its main content as Markdown. Use this to look up library APIs, error explanations, RFC text, or third-party docs that the user references.

WHEN TO USE:
  - User pastes a URL in their message and asks "what does this say?" / "summarize" / "use the API described here".
  - You need to look up a library version's actual API (npm / docs site / GitHub README), not guess.
  - You need to read an error's canonical explanation (e.g. an RFC, an MDN page, a TC39 proposal).
WHEN NOT TO USE:
  - Reading LOCAL project files \u2014 use read_file. web_fetch is for the public internet.
  - Searching the web \u2014 web_fetch fetches a SPECIFIC URL; you must already know it. There is no search tool yet.
  - Fetching internal / private hosts \u2014 blocked by SSRF guard (loopback, RFC1918, metadata).

BEHAVIOR:
  - HTML is converted to Markdown (headings/lists/code blocks/links preserved). JSON / plain text returned verbatim.
  - Content > 30KB is TRUNCATED with a marker. If you need more, fetch a more specific URL (anchor / sub-page).
  - Identical URLs are CACHED for 15 min \u2014 repeating the same fetch is free.
  - Returns { ok, status, finalUrl, title, content, truncated, cached }.

parallelSafe: true (pure read).`,
  parallelSafe: true,
  schema: external_exports.object({
    url: external_exports.string().url().describe("Absolute http(s) URL to fetch."),
    /** 可选：跳过缓存（debug 用，默认 false） */
    no_cache: external_exports.boolean().optional()
  }),
  async execute(input) {
    const url = input.url;
    const noCache = !!input.no_cache;
    const safe = ensureSafeUrl(url);
    if (!safe.ok) {
      return { ok: false, error: safe.reason };
    }
    const dnsSafe = await ensureSafeDns(safe.url);
    if (!dnsSafe.ok) {
      return { ok: false, error: dnsSafe.reason };
    }
    if (!noCache) {
      const hit = cacheGet(url);
      if (hit) {
        return {
          ok: true,
          status: 200,
          finalUrl: hit.finalUrl,
          title: hit.title,
          content: hit.text,
          truncated: hit.text.endsWith("[truncated]"),
          cached: true
        };
      }
    }
    let currentUrl = safe.url.toString();
    let redirects = 0;
    while (redirects <= MAX_REDIRECTS) {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 2e4);
      try {
        const resp = await fetch(currentUrl, {
          method: "GET",
          redirect: "manual",
          signal: ctrl.signal,
          headers: {
            "user-agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
            accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
          }
        });
        if ([301, 302, 303, 307, 308].includes(resp.status)) {
          const location = resp.headers.get("location");
          if (!location) {
            return { ok: false, error: `Redirect ${resp.status} without Location header` };
          }
          redirects++;
          if (redirects > MAX_REDIRECTS) {
            return { ok: false, error: `Too many redirects (max ${MAX_REDIRECTS})` };
          }
          const redirectUrl = new URL(location, currentUrl);
          const redirectSafe = ensureSafeUrl(redirectUrl.toString());
          if (!redirectSafe.ok) {
            return { ok: false, error: `Redirect to disallowed URL: ${redirectSafe.reason}` };
          }
          const redirectDnsSafe = await ensureSafeDns(redirectSafe.url);
          if (!redirectDnsSafe.ok) {
            return { ok: false, error: `Redirect DNS check failed: ${redirectDnsSafe.reason}` };
          }
          currentUrl = redirectSafe.url.toString();
          continue;
        }
        const ct = resp.headers.get("content-type") ?? "";
        const buf = await resp.arrayBuffer();
        let raw = new TextDecoder("utf-8", { fatal: false }).decode(buf);
        let title = "";
        let content = raw;
        if (/text\/html|application\/xhtml/i.test(ct)) {
          const md = htmlToMarkdown(raw);
          title = md.title;
          content = md.markdown;
        } else if (/application\/json/i.test(ct)) {
          try {
            content = JSON.stringify(JSON.parse(raw), null, 2);
          } catch {
          }
        }
        let truncated = false;
        if (content.length > MAX_CONTENT_BYTES) {
          content = content.slice(0, MAX_CONTENT_BYTES) + "\n\n...[truncated]";
          truncated = true;
        }
        const finalUrl = currentUrl;
        cachePut(url, { text: content, title, finalUrl });
        return {
          ok: resp.ok,
          status: resp.status,
          finalUrl,
          title,
          content,
          truncated,
          cached: false
        };
      } catch (e) {
        return {
          ok: false,
          error: e?.name === "AbortError" ? "Fetch timeout (20s)" : e?.message ?? String(e)
        };
      } finally {
        clearTimeout(timer);
      }
    }
    return { ok: false, error: `Too many redirects (max ${MAX_REDIRECTS})` };
  }
};

// ../../packages/core/src/agent/apply-patch-tool.ts
init_zod();
import { promises as fs3 } from "node:fs";
import path3 from "node:path";
function parsePatch(patch) {
  const lines = patch.split(/\r?\n/);
  const files = [];
  let cur = null;
  let curHunk = null;
  for (let i = 0; i < lines.length; i++) {
    const ln = lines[i];
    if (ln.startsWith("--- ")) {
      if (cur && curHunk) cur.hunks.push(curHunk);
      if (cur) files.push(cur);
      const oldPath = ln.slice(4).trim();
      cur = {
        oldPath: oldPath === "/dev/null" ? null : oldPath.replace(/^a\//, ""),
        newPath: null,
        hunks: []
      };
      curHunk = null;
      continue;
    }
    if (ln.startsWith("+++ ") && cur) {
      const newPath = ln.slice(4).trim();
      cur.newPath = newPath === "/dev/null" ? null : newPath.replace(/^b\//, "");
      continue;
    }
    if (ln.startsWith("@@ ") && cur) {
      if (curHunk) cur.hunks.push(curHunk);
      const m = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@/.exec(ln);
      if (!m) continue;
      curHunk = {
        oldStart: Number(m[1]),
        oldLines: Number(m[2] ?? "1"),
        newStart: Number(m[3]),
        newLines: Number(m[4] ?? "1"),
        lines: []
      };
      continue;
    }
    if (curHunk && (ln.startsWith(" ") || ln.startsWith("+") || ln.startsWith("-"))) {
      curHunk.lines.push(ln);
      continue;
    }
  }
  if (cur && curHunk) cur.hunks.push(curHunk);
  if (cur) files.push(cur);
  return files;
}
function applyHunk(source, hunk) {
  const srcLines = source.split("\n");
  const oldBlock = [];
  const newBlock = [];
  for (const ln of hunk.lines) {
    const tag = ln[0];
    const body = ln.slice(1);
    if (tag === " " || tag === "-") oldBlock.push(body);
    if (tag === " " || tag === "+") newBlock.push(body);
  }
  const start = Math.max(0, hunk.oldStart - 1);
  const matchExact = (idx) => {
    for (let i = 0; i < oldBlock.length; i++) {
      if (srcLines[idx + i] !== oldBlock[i]) return false;
    }
    return true;
  };
  let foundIdx = -1;
  if (matchExact(start)) {
    foundIdx = start;
  } else {
    for (let d = 1; d <= 10 && foundIdx < 0; d++) {
      if (start - d >= 0 && matchExact(start - d)) foundIdx = start - d;
      else if (start + d < srcLines.length && matchExact(start + d)) foundIdx = start + d;
    }
  }
  if (foundIdx < 0) {
    const trimmedOld = oldBlock.map((s) => s.trim());
    outer: for (let i = 0; i + oldBlock.length <= srcLines.length; i++) {
      let ok = true;
      for (let j = 0; j < oldBlock.length; j++) {
        if (srcLines[i + j].trim() !== trimmedOld[j]) {
          ok = false;
          break;
        }
      }
      if (ok) {
        foundIdx = i;
        break outer;
      }
    }
  }
  if (foundIdx < 0) {
    return {
      ok: false,
      error: `Hunk @@ -${hunk.oldStart},${hunk.oldLines} +${hunk.newStart},${hunk.newLines} @@ failed: context not found`
    };
  }
  const out = [
    ...srcLines.slice(0, foundIdx),
    ...newBlock,
    ...srcLines.slice(foundIdx + oldBlock.length)
  ];
  return { ok: true, result: out.join("\n") };
}
function resolveInside(cwd, p) {
  const abs = path3.resolve(cwd, p);
  if (!abs.startsWith(path3.resolve(cwd))) {
    throw new Error("Path escapes workspace");
  }
  return abs;
}
var applyPatchTool = {
  name: "apply_patch",
  description: `Apply a unified-diff patch (git-style) to one or more files in the workspace. Atomic per-file: all hunks of a file apply or none do. Supports new files (--- /dev/null), deleted files (+++ /dev/null), and multi-file patches.



WHEN TO USE:
- Multi-file refactor (3+ files changing together): one apply_patch is far cheaper in tokens than N edit_file calls.
- Renaming a symbol across the project after find_references.
- Replacing a known-good diff (e.g., from a previous tool result, a git log, or the user pastes one).
- Small single edit \u2013 use edit_file (smaller surface area, easier on retry).
- Auto-generated files where exact line numbers are unstable \u2013 use write_file with full content.

PATCH FORMAT (relaxed unified-diff):
--- a/path/to/file.ts
+++ b/path/to/file.ts
@@ -10,3 +10,4 @@
-old line A
+new line B
 unchanged context

BEHAVIOR:
- "All or nothing": if any hunk fails to find its context, the WHOLE file is rolled back.
- Diff tolerance: each hunk first tries exact match at its declared line, then \xB110 line search, then trim-equality fallback.
- Returns what you propose: { path, ok, action: "created"|"deleted"|"failed", error: } so you can retry only the failed files.
- All writes go through proposeEdit (user sees a Diff tab in the IDE before accept).`,
  parallelSafe: false,
  schema: external_exports.object({
    patch: external_exports.string().describe("The unified-diff patch text (one or more files).")
  }),
  async execute(input, ctx) {
    const { patch } = input;
    let parsed;
    try {
      parsed = parsePatch(patch);
    } catch (e) {
      return { ok: false, error: `parse error: ${e?.message ?? String(e)}` };
    }
    if (!parsed.length) {
      return { ok: false, error: "No file diffs found in patch (need at least one --- / +++ pair)." };
    }
    const results = [];
    for (const fp of parsed) {
      const targetPath = fp.newPath ?? fp.oldPath;
      if (!targetPath) {
        results.push({ path: "<unknown>", ok: false, action: "failed", error: "no path in diff header" });
        continue;
      }
      try {
        const abs = resolveInside(ctx.cwd, targetPath);
        if (fp.newPath === null && fp.oldPath) {
          try {
            await fs3.unlink(abs);
            results.push({ path: targetPath, ok: true, action: "deleted" });
          } catch (e) {
            results.push({ path: targetPath, ok: false, action: "failed", error: `unlink: ${e.message}` });
          }
          continue;
        }
        let source = "";
        let isNew = false;
        if (fp.oldPath === null) {
          isNew = true;
        } else {
          try {
            source = await fs3.readFile(abs, "utf8");
          } catch {
            isNew = true;
          }
        }
        let cur = source;
        let failed = null;
        for (const h of fp.hunks) {
          const r = applyHunk(cur, h);
          if (!r.ok) {
            failed = r.error;
            break;
          }
          cur = r.result;
        }
        if (failed) {
          results.push({ path: targetPath, ok: false, action: "failed", error: failed });
          continue;
        }
        if (ctx.proposeEdit) {
          await ctx.proposeEdit({ path: targetPath, newContent: cur, tool: "apply_patch" });
        } else {
          await fs3.mkdir(path3.dirname(abs), { recursive: true });
          await fs3.writeFile(abs, cur, "utf8");
        }
        results.push({ path: targetPath, ok: true, action: isNew ? "created" : "modified" });
      } catch (e) {
        results.push({ path: targetPath, ok: false, action: "failed", error: e.message ?? String(e) });
      }
    }
    const okCount = results.filter((r) => r.ok).length;
    return {
      ok: okCount > 0,
      results,
      summary: `${okCount}/${results.length} file(s) applied`,
      hint: okCount < results.length ? "Some files failed. Read them with read_file to see current content, then retry only the failed hunks with corrected line numbers / context." : void 0
    };
  }
};

// ../../packages/core/src/agent/git-tools.ts
init_zod();
import { execFile } from "node:child_process";
import { promises as fs4 } from "node:fs";
import path4 from "node:path";
import { promisify } from "node:util";
var pExecFile = promisify(execFile);
var MAX_BUFFER = 32 * 1024 * 1024;
async function git(cwd, args) {
  try {
    const r = await pExecFile("git", args, { cwd, maxBuffer: MAX_BUFFER });
    return { stdout: r.stdout ?? "", stderr: r.stderr ?? "" };
  } catch (e) {
    const stderr = (e?.stderr ?? "").toString().slice(0, 800);
    throw new Error(`git ${args.join(" ")} failed: ${stderr || e?.message}`);
  }
}
var gitStatusTool = {
  name: "git_status",
  description: "Get structured working-tree status (modified / added / deleted / untracked / renamed). Returns { branch, entries: [{ status, path, staged }] }.\n\nWHEN TO USE: before commit, to know what would be staged; or to verify your edits actually changed the working tree.\nWHEN NOT TO USE: if you only need a single file's diff \u2014 use git_diff with path.\n\nparallelSafe: true (read-only).",
  parallelSafe: true,
  schema: external_exports.object({}),
  async execute(_input, ctx) {
    const { stdout: branchOut } = await git(ctx.cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    const { stdout } = await git(ctx.cwd, ["status", "--porcelain=v1", "-z"]);
    const entries = [];
    const parts = stdout.split("\0").filter(Boolean);
    for (const seg of parts) {
      if (seg.length < 3) continue;
      const xy = seg.slice(0, 2);
      const p = seg.slice(3);
      const x = xy[0];
      const y = xy[1];
      if (x !== " " && x !== "?") {
        entries.push({ status: x, path: p, staged: true });
      }
      if (y !== " ") {
        const stat4 = y === "?" ? "?" : y;
        entries.push({ status: stat4, path: p, staged: false });
      }
    }
    return { ok: true, branch: branchOut.trim(), entries, count: entries.length };
  }
};
var gitDiffTool = {
  name: "git_diff",
  description: `Get a unified-diff of working tree or staged changes (optionally scoped to a file). Returns the raw diff text (truncated to 32KB).

WHEN TO USE:
  - Before commit: review what you actually changed.
  - After receiving "tests fail" hint: see what diverged from HEAD.
  - To produce a patch you can feed back to apply_patch.

OPTIONS: { path?: string, staged?: boolean, base?: string }. base="HEAD~1" gets last commit's diff.

parallelSafe: true.`,
  parallelSafe: true,
  schema: external_exports.object({
    path: external_exports.string().optional(),
    staged: external_exports.boolean().optional(),
    base: external_exports.string().optional().describe('Compare against a ref (e.g. "HEAD~1", "main")')
  }),
  async execute(input, ctx) {
    const { path: p, staged, base } = input;
    const args = ["diff"];
    if (staged) args.push("--cached");
    if (base) args.push(base);
    if (p) args.push("--", p);
    const { stdout } = await git(ctx.cwd, args);
    const truncated = stdout.length > 32e3;
    return { ok: true, diff: truncated ? stdout.slice(0, 32e3) + "\n...[truncated]" : stdout, truncated };
  }
};
var gitLogTool = {
  name: "git_log",
  description: "Get the most recent N commits (hash, short hash, ISO date, author, subject). Use to understand recent project history before making non-trivial changes.\n\nparallelSafe: true.",
  parallelSafe: true,
  schema: external_exports.object({
    n: external_exports.number().int().min(1).max(100).optional().default(20),
    path: external_exports.string().optional().describe("Limit to commits touching this path")
  }),
  async execute(input, ctx) {
    const { n, path: p } = input;
    const fmt = "%H%x1f%h%x1f%aI%x1f%an%x1f%s";
    const args = ["log", `--pretty=format:${fmt}`, `-n`, String(n)];
    if (p) args.push("--", p);
    const { stdout } = await git(ctx.cwd, args);
    const commits = stdout.split("\n").filter(Boolean).map((ln) => {
      const [hash, shortHash, date, author, subject] = ln.split("");
      return { hash, shortHash, date, author, subject };
    });
    return { ok: true, commits, count: commits.length };
  }
};
var gitBranchTool = {
  name: "git_branch",
  description: "Get the current branch name. parallelSafe: true.",
  parallelSafe: true,
  schema: external_exports.object({}),
  async execute(_input, ctx) {
    const { stdout } = await git(ctx.cwd, ["rev-parse", "--abbrev-ref", "HEAD"]);
    return { ok: true, branch: stdout.trim() };
  }
};
var gitCommitTool = {
  name: "git_commit",
  description: 'Stage and commit changes. By default stages all modified+untracked files (git add -A); pass `paths` to scope. The commit message is passed via -F (file), so quotes/newlines in the message are safe.\n\nWHEN TO USE: after the user explicitly asks for a commit, OR after auto-verify passes and the user has accepted all edits.\nWHEN NOT TO USE: speculatively. NEVER commit without user intent \u2014 even if "all tests pass". Commits are user-visible state changes.\n\nBEHAVIOR:\n  - Returns { ok, hash, subject, filesChanged }.\n  - If working tree is clean, returns { ok: false, error: "nothing to commit" } \u2014 do NOT retry.\n  - Conventional commits style is recommended ("feat:", "fix:", "chore:").\n\nNOT parallelSafe (write).',
  parallelSafe: false,
  requiresApproval: true,
  // 默认进 ask 流程；后端 exec policy 可放行
  schema: external_exports.object({
    message: external_exports.string().min(1).describe("Commit message (multi-line OK)."),
    paths: external_exports.array(external_exports.string()).optional().describe("If empty/omitted, stages all (git add -A).")
  }),
  async execute(input, ctx) {
    const { message, paths } = input;
    if (paths && paths.length) {
      await git(ctx.cwd, ["add", "--", ...paths]);
    } else {
      await git(ctx.cwd, ["add", "-A"]);
    }
    const tmp = path4.join(ctx.cwd, ".minicodeide-commit-" + Date.now() + ".txt");
    await fs4.writeFile(tmp, message, "utf-8");
    try {
      await git(ctx.cwd, ["commit", "-F", tmp]);
    } catch (e) {
      const msg = String(e?.message ?? "");
      if (/nothing to commit/i.test(msg)) {
        return { ok: false, error: "nothing to commit (working tree clean or no staged changes)" };
      }
      throw e;
    } finally {
      await fs4.unlink(tmp).catch(() => void 0);
    }
    const fmt = "%H%x1f%h%x1f%s";
    const { stdout } = await git(ctx.cwd, ["log", "-1", `--pretty=format:${fmt}`]);
    const [hash, shortHash, subject] = stdout.split("");
    return { ok: true, hash, shortHash, subject };
  }
};

// ../../packages/core/src/agent/image-tools.ts
init_zod();
import { promises as fs5 } from "node:fs";
import path5 from "node:path";
function resolveInside2(cwd, p) {
  const abs = path5.resolve(cwd, p);
  if (!abs.startsWith(path5.resolve(cwd))) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return abs;
}
var IMAGE_EXTENSIONS = /* @__PURE__ */ new Set([
  ".png",
  ".jpg",
  ".jpeg",
  ".gif",
  ".webp",
  ".bmp",
  ".svg",
  ".ico",
  ".tiff",
  ".tif"
]);
function isImagePath(p) {
  const ext = path5.extname(p).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
function getMimeType(p) {
  const ext = path5.extname(p).toLowerCase();
  const map = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".gif": "image/gif",
    ".webp": "image/webp",
    ".bmp": "image/bmp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".tiff": "image/tiff",
    ".tif": "image/tiff"
  };
  return map[ext] ?? "image/png";
}
var readImageTool = {
  name: "read_image",
  description: 'Read an image file from the workspace and return it as base64-encoded data with metadata.\n\nWHEN TO USE:\n  - You need to see a UI screenshot, design mockup, diagram, or any visual asset.\n  - Debugging visual/UI issues \u2014 the user says "the button looks broken" and you need to see it.\n  - Analyzing image content (icons, layouts, CSS screenshots, etc).\n\nWHEN NOT TO USE:\n  - For text/code files \u2014 use read_file instead.\n  - For searching across files \u2014 use grep_search or list_files.\n\nBEHAVIOR:\n  - Returns the image as base64 data, plus a text description placeholder.\n  - If the provider supports multimodal input (Anthropic/OpenAI), the image is sent as a vision content block.\n  - If the provider does NOT support multimodal, you get only the placeholder text (file name, size, dimensions hint).\n  - Supports: PNG, JPG, GIF, WebP, BMP, SVG, TIFF.\n  - Maximum file size: 5MB (larger files are rejected).\n\nPERFORMANCE: moderate (base64 encoding). parallelSafe: true.',
  parallelSafe: true,
  schema: external_exports.object({
    path: external_exports.string().describe("Path to image file relative to workspace")
  }),
  async execute(input, ctx) {
    const relPath = input.path;
    const abs = resolveInside2(ctx.cwd, relPath);
    if (!isImagePath(relPath)) {
      return {
        ok: false,
        error: `Not an image file: ${relPath}. Supported formats: PNG, JPG, JPEG, GIF, WebP, BMP, SVG, TIFF.`,
        hint: "Use read_file for text/code files."
      };
    }
    let stat4;
    try {
      stat4 = await fs5.stat(abs);
    } catch {
      return {
        ok: false,
        error: `Image file not found: ${relPath}`,
        hint: "Check the path; try list_files on the parent directory first."
      };
    }
    const MAX_SIZE = 5 * 1024 * 1024;
    if (stat4.size > MAX_SIZE) {
      return {
        ok: false,
        error: `Image too large: ${(stat4.size / 1024 / 1024).toFixed(1)}MB exceeds 5MB limit.`,
        hint: "Consider resizing the image or using a smaller format (WebP/JPG)."
      };
    }
    const buffer = await fs5.readFile(abs);
    const base64 = buffer.toString("base64");
    const mimeType = getMimeType(relPath);
    return {
      ok: true,
      content: `[image: ${relPath} (${mimeType}, ${(stat4.size / 1024).toFixed(0)}KB)]`,
      __image: {
        type: "image",
        data: base64,
        media_type: mimeType,
        path: relPath,
        size_bytes: stat4.size
      }
    };
  }
};
var screenshotTool = {
  name: "screenshot",
  description: 'Take a screenshot of a web page or local HTML file and return it as an image.\n\nWHEN TO USE:\n  - Debugging UI/CSS issues \u2014 "the layout looks wrong, take a screenshot of index.html".\n  - Visual review of designs, mockups, or rendered pages.\n  - You want to see how a web component looks in the browser.\n\nWHEN NOT TO USE:\n  - For reading code/text content \u2014 use read_file.\n  - For existing image files \u2014 use read_image.\n\nBEHAVIOR:\n  - Takes a URL (http://...) or a local HTML file path.\n  - Returns the screenshot as base64-encoded PNG.\n  - If Puppeteer is not available, returns a fallback message.\n  - Default viewport: 1280x800. Pass width/height to customize.\n\nPERFORMANCE: moderate (Puppeteer launch + render). parallelSafe: false.',
  parallelSafe: false,
  schema: external_exports.object({
    url: external_exports.string().optional().describe("URL to screenshot (http:// or https://)"),
    path: external_exports.string().optional().describe("Local HTML file path relative to workspace"),
    width: external_exports.number().int().optional().describe("Viewport width (default 1280)"),
    height: external_exports.number().int().optional().describe("Viewport height (default 800)")
  }),
  async execute(input, ctx) {
    const vpWidth = input.width ?? 1280;
    const vpHeight = input.height ?? 800;
    let target;
    if (input.url) {
      target = input.url;
    } else if (input.path) {
      const abs = resolveInside2(ctx.cwd, input.path);
      try {
        await fs5.stat(abs);
      } catch {
        return { ok: false, error: `File not found: ${input.path}` };
      }
      target = `file://${abs}`;
    } else {
      return {
        ok: false,
        error: "Must provide either url or path parameter."
      };
    }
    try {
      const puppeteer = await import("puppeteer");
      const browser = await puppeteer.launch({
        headless: true,
        args: ["--no-sandbox", "--disable-setuid-sandbox"]
      });
      const page = await browser.newPage();
      await page.setViewport({ width: vpWidth, height: vpHeight });
      await page.goto(target, { waitUntil: "networkidle0", timeout: 15e3 });
      await page.waitForTimeout(500);
      const buffer = await page.screenshot({ type: "png", fullPage: false });
      await browser.close();
      const base64 = buffer.toString("base64");
      return {
        ok: true,
        content: `[screenshot: ${target} (${vpWidth}x${vpHeight})]`,
        __image: {
          type: "image",
          data: base64,
          media_type: "image/png",
          path: target,
          size_bytes: buffer.length
        }
      };
    } catch (e) {
      const msg = e?.message ?? String(e);
      if (msg.includes("Cannot find module") || msg.includes("puppeteer")) {
        return {
          ok: false,
          error: "Puppeteer is not installed. Install it with: pnpm add puppeteer",
          hint: "For local HTML files, you can also use read_image if you have a pre-rendered screenshot."
        };
      }
      return {
        ok: false,
        error: `Screenshot failed: ${msg}`
      };
    }
  }
};

// ../../packages/core/src/agent/builtin-tools.ts
var pExecFile2 = promisify2(execFile2);
function resolveInside3(cwd, p) {
  const abs = path6.resolve(cwd, p);
  if (!abs.startsWith(path6.resolve(cwd))) {
    throw new Error(`Path escapes workspace: ${p}`);
  }
  return abs;
}
function findSimilarLines(source, needle, topN) {
  const firstNeedleLine = needle.split("\n")[0].trim();
  if (!firstNeedleLine) return [];
  const sourceLines = source.split("\n");
  const scored = [];
  for (let i = 0; i < sourceLines.length; i++) {
    const ln = sourceLines[i].trim();
    if (!ln) continue;
    const score = commonPrefixLen(ln, firstNeedleLine) + commonSubstrLen(ln, firstNeedleLine);
    if (score >= 6) {
      scored.push({ line: i + 1, text: sourceLines[i].slice(0, 200), score });
    }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, topN);
}
function commonPrefixLen(a, b) {
  let i = 0;
  const n = Math.min(a.length, b.length);
  while (i < n && a[i] === b[i]) i++;
  return i;
}
function commonSubstrLen(a, b) {
  const n = a.length;
  const m = b.length;
  if (n === 0 || m === 0) return 0;
  let best = 0;
  let prev = new Array(m + 1).fill(0);
  let curr = new Array(m + 1).fill(0);
  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (a[i - 1] === b[j - 1]) {
        curr[j] = prev[j - 1] + 1;
        if (curr[j] > best) best = curr[j];
      } else {
        curr[j] = 0;
      }
    }
    [prev, curr] = [curr, prev];
    curr.fill(0);
  }
  return best;
}
var readFileTool = {
  name: "read_file",
  description: 'Read the contents of a file as UTF-8 text and return it with line numbers.\n\nWHEN TO USE:\n  - You need to see actual file contents before editing or analyzing.\n  - You want to cite a specific path:line in your reply.\nWHEN NOT TO USE:\n  - To search across many files \u2014 use grep_search instead.\n  - To check whether a file exists \u2014 use list_files on the parent directory.\n  - To read binary files \u2014 this tool only handles UTF-8 text.\n\nBEHAVIOR:\n  - Default returns the first 500 lines. Pass start_line / end_line for windowed reads.\n  - Each line is prefixed with its 1-based line number in the form "  42\u2192content". The arrow (\u2192) is a separator; line numbers are display-only metadata.\n  - When the requested window exceeds the file, the result is truncated and a hint is returned with the next start_line to continue from.\n  - If the path is wrong, returns ok:false with sibling-entry hints ("did you mean ...?"). Do NOT retry blindly with the same path; pick from the suggestions or use list_files.\n\nEDITING NOTE: when you later call edit_file, do NOT include the line-number prefix ("  42\u2192") in oldString. Use only the actual file content (the part after the arrow). Preserve exact indentation (tabs vs spaces) and trailing whitespace.\n\nPERFORMANCE: cheap. parallelSafe: emit multiple read_file calls in one turn to read several files at once.',
  parallelSafe: true,
  schema: external_exports.object({
    path: external_exports.string().describe("Path relative to workspace"),
    start_line: external_exports.number().int().optional().describe("1-based inclusive; defaults to 1"),
    end_line: external_exports.number().int().optional().describe("1-based inclusive; defaults to start_line + 500")
  }),
  async execute(input, ctx) {
    const abs = resolveInside3(ctx.cwd, input.path);
    let text;
    try {
      text = await fs6.readFile(abs, "utf-8");
    } catch (e) {
      const dir = path6.dirname(abs);
      let siblings = [];
      try {
        siblings = (await fs6.readdir(dir)).slice(0, 20);
      } catch {
      }
      return {
        ok: false,
        error: `Cannot read file: ${e?.message ?? e}`,
        hint: siblings.length > 0 ? `Sibling entries in ${path6.relative(ctx.cwd, dir)}: ${siblings.join(", ")}. Did you mean one of these?` : "Check the path; try list_files on the parent directory first."
      };
    }
    const lines = text.split("\n");
    const total = lines.length;
    const DEFAULT_WINDOW = 500;
    const s0 = Math.max(0, (input.start_line ?? 1) - 1);
    const requestedEnd = input.end_line;
    const e0 = Math.min(total, requestedEnd ?? Math.min(total, s0 + DEFAULT_WINDOW));
    const slice = lines.slice(s0, e0);
    const numbered = slice.map((ln, i) => {
      const lineNo = String(s0 + i + 1).padStart(6, " ");
      return `${lineNo}\u2192${ln}`;
    }).join("\n");
    const truncated = e0 < total;
    const omitted = total - e0;
    return {
      content: numbered,
      path: input.path,
      start_line: s0 + 1,
      end_line: e0,
      total_lines: total,
      truncated,
      ...truncated ? {
        hint: `Showed lines ${s0 + 1}-${e0} of ${total}. ${omitted} more lines below. Call read_file again with start_line=${e0 + 1} to continue, or use grep_search / list_file_symbols to navigate.`
      } : {}
    };
  }
};
var writeFileTool = {
  name: "write_file",
  description: "Create a new file or completely replace an existing file's contents. The change goes through the user's pending-edit review (Diff Editor); the file on disk is NOT modified until the user clicks Accept.\n\nWHEN TO USE:\n  - The file does NOT exist yet (brand-new file).\n  - You are rewriting > 70% of an existing file (full overwrite is cleaner than many edit_file calls).\nWHEN NOT TO USE:\n  - For small targeted changes \u2014 use edit_file (preserves surrounding context, smaller diff).\n  - To append to a file \u2014 read_file first, then write_file with prepended old content. There is no append mode.\n\nBEHAVIOR:\n  - Returns { pendingEditId } on success. The user reviews the diff and decides.\n  - Same file proposed multiple times will MERGE in pending state \u2014 your latest content wins.\n  - Path is resolved inside the workspace (cannot escape with ../).\n\nIMPORTANT: this tool is NOT parallelSafe. The agent loop runs write tools serially in the order you emit them. Order matters when one file imports another.",
  schema: external_exports.object({ path: external_exports.string(), content: external_exports.string() }),
  async execute(input, ctx) {
    const rel = input.path;
    const content = input.content;
    if (ctx.proposeEdit) {
      const { id } = await ctx.proposeEdit({ path: rel, newContent: content, tool: "write_file" });
      return { ok: true, pendingEditId: id, message: "Diff sent to user for review" };
    }
    const abs = resolveInside3(ctx.cwd, rel);
    await fs6.mkdir(path6.dirname(abs), { recursive: true });
    await fs6.writeFile(abs, content, "utf-8");
    return { ok: true, path: rel };
  }
};
var editFileTool = {
  name: "edit_file",
  description: 'Propose a precise, in-place edit to an existing file by replacing oldString with newString. The change goes through pending-edit review; the file on disk is NOT modified until the user clicks Accept.\n\nWHEN TO USE:\n  - Targeted changes (rename, fix bug, add a function, modify a config value).\n  - You can clearly identify a unique passage of existing code to anchor on.\nWHEN NOT TO USE:\n  - For brand-new files \u2014 use write_file.\n  - For full-file rewrites \u2014 use write_file (faster, lower error rate).\n  - To make many edits to the same file in one turn \u2014 emit multiple edit_file calls; they will be merged.\n\nCRITICAL RULES:\n  1. ALWAYS read_file the target first. Do NOT guess what the file currently contains.\n  2. oldString MUST match the existing content EXACTLY \u2014 same whitespace, tabs, trailing spaces, and newlines. The tool will FAIL if oldString is not found.\n  3. oldString MUST be UNIQUE in the file. If your edit could match in 2+ places, include MORE surrounding context (1-3 anchor lines above/below) until it is unique.\n  4. Do NOT include line-number prefixes (e.g. "  42\u2192") from read_file output \u2014 those are display metadata. Use only the actual content after the arrow separator.\n  5. To replace every occurrence, set replaceAll:true. Otherwise only the first match is replaced.\n\nFAILURE HANDLING:\n  - On miss, the tool returns didYouMean candidates: the 3 lines in the file most similar to your oldString. Use them to refine, then retry. Do NOT retry with the same oldString.\n  - If you fail twice, STOP and either read_file again with a wider window or rethink the approach.\n\nINTERNAL: uses fuzzy-apply (exact \u2192 trim-line \u2192 whitespace-collapse \u2192 line-anchor) before giving up. Returns matchStrategy in the success result so you know which path matched.',
  schema: external_exports.object({
    path: external_exports.string(),
    oldString: external_exports.string(),
    newString: external_exports.string(),
    /** 替换所有出现，默认仅第一处 */
    replaceAll: external_exports.boolean().optional()
  }),
  async execute(input, ctx) {
    const rel = input.path;
    const oldS = input.oldString;
    const newS = input.newString;
    const replaceAll = !!input.replaceAll;
    const before = ctx.virtualRead ? await ctx.virtualRead(rel) : await fs6.readFile(resolveInside3(ctx.cwd, rel), "utf-8");
    const result = fuzzyApply(before, oldS, newS, { replaceAll });
    if (!result.ok || !result.next) {
      const candidates = findSimilarLines(before, oldS, 3);
      const hint = `${result.reason ?? "oldString not found"}. Tip: keep oldString small (5-15 lines), avoid trailing whitespace, and include unique surrounding lines as anchor.`;
      throw new Error(
        JSON.stringify({
          error: "edit_failed",
          message: hint,
          didYouMean: candidates,
          suggestion: candidates.length > 0 ? "The file contains lines that look similar. Read the file again and copy the exact text verbatim." : "No similar lines found. Are you sure the path is right? Use read_file to verify the current content."
        })
      );
    }
    const next = result.next;
    if (ctx.proposeEdit) {
      const { id } = await ctx.proposeEdit({ path: rel, newContent: next, tool: "edit_file" });
      return {
        ok: true,
        pendingEditId: id,
        message: "Diff sent to user for review",
        matchStrategy: result.strategy
      };
    }
    await fs6.writeFile(resolveInside3(ctx.cwd, rel), next, "utf-8");
    return { ok: true, matchStrategy: result.strategy };
  }
};
var listFilesTool = {
  name: "list_files",
  description: 'List entries (files and subdirectories) in a directory of the workspace. Returns structured items with type, name, and size in bytes.\n\nWHEN TO USE:\n  - You need to know what is in a specific directory before reading.\n  - The user mentioned a folder by name and you want to inspect its layout.\nWHEN NOT TO USE:\n  - To search for code by content \u2014 use grep_search.\n  - To find a symbol by name \u2014 use find_symbol.\n  - To answer "where is the code for X?" \u2014 use semantic_search.\n  - To recursively walk a large repo \u2014 do NOT. It will return thousands of items and waste context. Prefer targeted grep / semantic_search.\n\nBEHAVIOR:\n  - By default ignores node_modules, .git, dist, build, .next, .minicodeide, and dotfiles. This is the right behavior 95% of the time.\n  - recursive:true walks subdirectories. Use sparingly.\n  - parallelSafe: combine with read_file in one turn for fast file overview.',
  parallelSafe: true,
  schema: external_exports.object({
    path: external_exports.string().default("."),
    recursive: external_exports.boolean().optional(),
    /** 最多返回多少条；默认 200 */
    limit: external_exports.number().int().min(1).max(2e3).optional()
  }),
  async execute(input, ctx) {
    const abs = resolveInside3(ctx.cwd, input.path);
    const limit = input.limit ?? 200;
    const recursive = !!input.recursive;
    const out = [];
    let truncated = false;
    const walk2 = async (dir) => {
      if (out.length >= limit) {
        truncated = true;
        return;
      }
      let entries = [];
      try {
        entries = await fs6.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      entries.sort((a, b) => {
        if (a.isDirectory() !== b.isDirectory()) return a.isDirectory() ? -1 : 1;
        return a.name.localeCompare(b.name);
      });
      for (const e of entries) {
        if (out.length >= limit) {
          truncated = true;
          return;
        }
        if (e.name === "node_modules" || e.name === "dist" || e.name === ".git" || e.name === ".minicodeide" || e.name.startsWith(".")) {
          continue;
        }
        const full = path6.join(dir, e.name);
        const rel = path6.relative(ctx.cwd, full);
        if (e.isDirectory()) {
          out.push({ path: rel, type: "dir" });
          if (recursive) await walk2(full);
        } else {
          let size;
          try {
            const st = await fs6.stat(full);
            size = st.size;
          } catch {
          }
          out.push({ path: rel, type: "file", size });
        }
      }
    };
    await walk2(abs);
    return {
      ok: true,
      root: input.path,
      count: out.length,
      truncated,
      entries: out,
      ...truncated ? {
        hint: `Truncated at ${limit}. Pass limit=<n> to fetch more, or scope down with a deeper path.`
      } : {}
    };
  }
};
var grepTool = {
  name: "grep_search",
  description: 'Search files in the workspace using a regular expression. Returns matching lines with their 1-based line numbers and (optionally) surrounding context.\n\nWHEN TO USE:\n  - You have a literal token to find: a function name, an import path, an error message, a config key, a CSS class.\n  - You want to find ALL call sites of something (combine with find_references for symbols you can identify by name).\n  - PREFER grep_search over semantic_search when you have keywords. Embedding-based search is fuzzy; literal grep is precise.\nWHEN NOT TO USE:\n  - Conceptual questions like "where is auth handled?" \u2014 use semantic_search.\n  - Looking up a symbol definition by exact name \u2014 use find_symbol (faster, returns the signature).\n  - Reading a known file end-to-end \u2014 use read_file.\n\nPATTERN TIPS:\n  - JS regex syntax. Escape special chars: ( ) [ ] { } . * + ? \\ |\n  - Use case_insensitive:true to relax matching.\n  - Use context_lines:N (0-10) to see surrounding lines (great for understanding the call site).\n  - Use file_pattern with glob-ish basenames: "*.ts", "*.{md,mdx}", "*.test.ts".\n\nBEHAVIOR:\n  - Auto-skips node_modules, .git, dist, dotfiles.\n  - Caps at 200 hits and returns truncated:true \u2014 narrow the pattern or path if you hit the cap.\n  - parallelSafe: emit multiple grep_search calls (different patterns / paths) in one turn for fast triangulation.\n\nIF YOU GET 0 HITS: try (a) case_insensitive, (b) relax the regex (drop word boundaries), (c) widen file_pattern, (d) check the path. Do NOT retry with the exact same args.',
  parallelSafe: true,
  schema: external_exports.object({
    pattern: external_exports.string().describe("Regex pattern (JS syntax)"),
    path: external_exports.string().default("."),
    /** glob 风格的文件名过滤；e.g. "*.ts" / "*.{md,mdx}" */
    file_pattern: external_exports.string().optional().describe('Glob pattern over file basename, e.g. "*.ts" or "*.{md,mdx}"'),
    case_insensitive: external_exports.boolean().optional(),
    /** 每条命中前后展示的行数 */
    context_lines: external_exports.number().int().min(0).max(10).optional().describe("Lines of context before/after the match (default 0)"),
    /** 老字段保留兼容 */
    glob: external_exports.string().optional()
  }),
  async execute(input, ctx) {
    const abs = resolveInside3(ctx.cwd, input.path);
    const flags = input.case_insensitive ? "i" : "";
    let re;
    try {
      re = new RegExp(input.pattern, flags);
    } catch (e) {
      return { ok: false, error: `Invalid regex: ${e?.message ?? e}`, hint: "Escape special chars like ( ) [ ] { } . * + ? \\" };
    }
    const fileGlob = input.file_pattern ?? input.glob;
    const globRe = fileGlob ? globToRegex(fileGlob) : null;
    const ctxN = input.context_lines ?? 0;
    const hits = [];
    let filesScanned = 0;
    let filesSkipped = 0;
    const walk2 = async (dir) => {
      if (hits.length >= 200) return;
      let entries = [];
      try {
        entries = await fs6.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (hits.length >= 200) return;
        if (e.name === "node_modules" || e.name === "dist" || e.name === ".git" || e.name.startsWith(".")) {
          continue;
        }
        const full = path6.join(dir, e.name);
        if (e.isDirectory()) {
          await walk2(full);
        } else {
          if (globRe && !globRe.test(e.name)) {
            filesSkipped += 1;
            continue;
          }
          filesScanned += 1;
          try {
            const text = await fs6.readFile(full, "utf-8");
            const lines = text.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (re.test(lines[i])) {
                const hit = {
                  file: path6.relative(ctx.cwd, full),
                  line: i + 1,
                  text: lines[i].slice(0, 400)
                };
                if (ctxN > 0) {
                  const lo = Math.max(0, i - ctxN);
                  const hi = Math.min(lines.length, i + ctxN + 1);
                  hit.context = [];
                  for (let j = lo; j < hi; j++) {
                    if (j === i) continue;
                    hit.context.push({ line: j + 1, text: lines[j].slice(0, 400) });
                  }
                }
                hits.push(hit);
                if (hits.length >= 200) return;
              }
            }
          } catch {
          }
        }
      }
    };
    await walk2(abs);
    return {
      ok: true,
      pattern: input.pattern,
      count: hits.length,
      truncated: hits.length >= 200,
      files_scanned: filesScanned,
      files_skipped: filesSkipped,
      hits,
      ...hits.length === 0 ? {
        hint: "No matches found. Try: case_insensitive:true, or relax the pattern (escape special chars), or widen file_pattern. For conceptual queries, semantic_search is better than grep."
      } : {}
    };
  }
};
function globToRegex(glob) {
  let re = "^";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else if (c === ".") re += "\\.";
    else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end < 0) {
        re += "\\{";
      } else {
        const inner = glob.slice(i + 1, end).split(",");
        re += "(?:" + inner.map((s) => s.replace(/\./g, "\\.")).join("|") + ")";
        i = end;
      }
    } else if (/[a-zA-Z0-9_\-]/.test(c)) {
      re += c;
    } else {
      re += "\\" + c;
    }
    i++;
  }
  re += "$";
  return new RegExp(re);
}
var runCommandTool = {
  name: "run_command",
  description: 'Execute a shell command in the workspace and return its stdout/stderr/exit code. The command goes through an exec policy that classifies it as auto-run / require-approval / auto-deny.\n\nWHEN TO USE:\n  - Run tests / lints / builds / type-checks (these are the high-value use cases).\n  - Inspect git state (`git status`, `git log`, `git diff`).\n  - Run a project-specific script defined in package.json.\nWHEN NOT TO USE:\n  - To READ files \u2014 use read_file (no shell needed, structured output).\n  - To LIST files \u2014 use list_files.\n  - To EDIT files \u2014 use edit_file or write_file. Do NOT pipe `echo "..." > file` \u2014 it bypasses pending-edit review.\n  - To search code \u2014 use grep_search.\n\nPOLICY (you cannot bypass this):\n  - AUTO-RUN: ls / cat / grep / git status / pnpm test / tsc \u2014 run immediately.\n  - ASK: rm / git commit / git push / unknown commands \u2014 user must Approve in the UI before running.\n  - DENY: sudo / rm -rf / / curl to internal hosts / `base64 -d | sh` and other obfuscation \u2014 returns ok:false, denied:true. Do not try to bypass with `node -e "require(\'child_process\')..."` workarounds; that is also caught by review.\n\nBACKGROUND MODE:\n  - Set run_in_background:true for long-running commands (npm install, pytest suite, docker build, dev server).\n  - Returns { ok:true, bg_id } immediately. You can continue with other tools while it runs.\n  - Later call get_background_result(id) to fetch output, list_background_tasks() to see all, cancel_background_task(id) to kill.\n  - The system auto-detects likely-slow commands and may switch to background mode even if you didn\'t set the flag.\n\nQUOTING: ALWAYS quote paths that may contain spaces. Single-quote literal strings to prevent shell expansion.\n\nNOT parallelSafe: write/exec class. Runs serially in the order emitted.',
  schema: external_exports.object({
    command: external_exports.string(),
    cwd: external_exports.string().optional(),
    run_in_background: external_exports.boolean().optional()
  }),
  // requiresApproval 不再硬开 —— 改由 execPolicy 动态决定（ask 时 ctx.approve）
  async execute(input, ctx) {
    const command = input.command;
    const cwd = input.cwd ? resolveInside3(ctx.cwd, input.cwd) : ctx.cwd;
    const runBg = !!input.run_in_background || isLikelySlow(command);
    const decision = ctx.execPolicy ? ctx.execPolicy(command) : { verdict: "ask", reason: "no policy configured", matchedRule: "no-policy" };
    if (decision.verdict === "deny") {
      return {
        ok: false,
        denied: true,
        reason: decision.reason,
        matchedRule: decision.matchedRule,
        hint: "Command was denied by exec policy. Consider a safer alternative: use read_file/list_files/grep for inspection, edit_file for changes. Avoid sudo / rm -rf / curl / ssh \u2014 propose to the user instead."
      };
    }
    if (decision.verdict === "ask") {
      if (!ctx.approve) {
        return {
          ok: false,
          denied: true,
          reason: "Command requires approval but no approver wired",
          matchedRule: decision.matchedRule
        };
      }
      const ok = await ctx.approve({
        tool: "run_command",
        args: { command, cwd, reason: decision.reason, matchedRule: decision.matchedRule, runBg }
      });
      if (!ok) {
        return {
          ok: false,
          denied: true,
          reason: "User rejected command",
          matchedRule: "user-reject"
        };
      }
    }
    if (runBg && ctx.backgroundTasks) {
      try {
        const t = ctx.backgroundTasks.start(command, cwd);
        return {
          ok: true,
          bg_id: t.id,
          status: t.status,
          message: `Command started in background (id=${t.id}). Continue with other work; call \`get_background_result\` with this id to fetch stdout when ready.`
        };
      } catch (e) {
        return { ok: false, error: e?.message ?? String(e), policy: decision };
      }
    }
    if (ctx.checkpoint) {
      const affectedFiles = detectAffectedFiles(command, ctx.cwd);
      if (affectedFiles.length > 0) {
        await ctx.checkpoint({
          label: `run_command: ${command.slice(0, 60)}`,
          trigger: "run_command",
          files: affectedFiles.map((p) => ({ path: p, newContent: "" }))
        }).catch(() => void 0);
      }
    }
    try {
      const { stdout, stderr } = await pExecFile2("sh", ["-c", command], {
        cwd,
        timeout: 6e4,
        maxBuffer: 4 * 1024 * 1024
      });
      return { ok: true, stdout, stderr, policy: decision };
    } catch (e) {
      return {
        ok: false,
        error: e?.message ?? String(e),
        stdout: e?.stdout ?? "",
        stderr: e?.stderr ?? "",
        policy: decision
      };
    }
  }
};
function isLikelySlow(cmd) {
  const c = cmd.toLowerCase();
  const slow = [
    "npm install",
    "pnpm install",
    "yarn install",
    "npm i ",
    "pnpm i ",
    "npm run build",
    "pnpm run build",
    "pnpm build",
    "yarn build",
    "pip install",
    "cargo build",
    "cargo run",
    "go build",
    "mvn ",
    "docker build",
    "docker compose up",
    "docker-compose up",
    "pytest",
    "jest",
    "vitest run",
    "tsc -b"
  ];
  return slow.some((kw) => c.includes(kw));
}
function detectAffectedFiles(command, cwd) {
  const cmd = command.trim();
  const files = [];
  const segments = cmd.split(/\s*(?:\|\||&&|\||;)\s*/);
  for (const seg of segments) {
    const trimmedSeg = seg.trim();
    if (!trimmedSeg) continue;
    for (const m of trimmedSeg.matchAll(/>{1,2}\s*(\S+)/g)) {
      const target = m[1];
      if (target && !target.startsWith("-") && !target.endsWith("/")) {
        files.push(target);
      }
    }
    const parts = trimmedSeg.split(/\s+/);
    if (parts.length === 0) continue;
    const prog = parts[0].replace(/^(?:sudo\s+)?/, "").split("/").pop()?.toLowerCase() ?? "";
    if (prog === "cp" || prog === "mv" || prog === "ln") {
      const target = parts[parts.length - 1];
      if (target && !target.startsWith("-") && !target.endsWith("/")) {
        files.push(target);
      }
    } else if (prog === "touch") {
      for (const p of parts.slice(1)) {
        if (!p.startsWith("-") && !p.endsWith("/")) files.push(p);
      }
    } else if (prog === "mkdir") {
      for (const p of parts.slice(1)) {
        if (!p.startsWith("-") && !p.endsWith("/")) files.push(p);
      }
    } else if (prog === "rm") {
      for (const p of parts.slice(1)) {
        if (!p.startsWith("-") && !p.endsWith("/")) files.push(p);
      }
    } else if (prog === "sed" || prog === "awk") {
      if (seg.includes(" -i ")) {
        const target = parts[parts.length - 1];
        if (target && !target.startsWith("-") && target.includes(".")) files.push(target);
      }
    } else if (prog === "tee") {
      for (const p of parts.slice(1)) {
        if (!p.startsWith("-") && !p.startsWith(">") && !p.endsWith("/")) files.push(p);
      }
    } else if (prog === "patch" || prog === "git" && parts[1] === "apply") {
    } else if ((prog === "npm" || prog === "pnpm" || prog === "yarn") && parts.slice(1).some((p) => p === "install" || p === "i" || p === "add")) {
      files.push("package.json", "package-lock.json");
    } else if (prog === "pip" && parts.slice(1).some((p) => p === "install")) {
      files.push("requirements.txt");
    }
  }
  return [...new Set(files)].filter((f) => f && !f.startsWith("-"));
}
var listBackgroundTasksTool = {
  name: "list_background_tasks",
  description: "List all background tasks started via run_command(run_in_background=true). Returns id / command / status (running|completed|failed|cancelled) / startedAt / exitCode.",
  schema: external_exports.object({}),
  parallelSafe: true,
  async execute(_input, ctx) {
    if (!ctx.backgroundTasks) return { tasks: [] };
    return { tasks: ctx.backgroundTasks.list() };
  }
};
var getBackgroundResultTool = {
  name: "get_background_result",
  description: "Fetch stdout/stderr/exit code of a background task by id. Status will be one of running|completed|failed|cancelled. If still running, returns partial output so far.",
  schema: external_exports.object({ id: external_exports.string() }),
  parallelSafe: true,
  async execute(input, ctx) {
    if (!ctx.backgroundTasks) return { error: "no background task manager wired" };
    const t = ctx.backgroundTasks.get(input.id);
    if (!t) return { error: `No background task ${input.id}` };
    return t;
  }
};
var cancelBackgroundTaskTool = {
  name: "cancel_background_task",
  description: "Cancel a running background task by id (sends SIGTERM, then SIGKILL after 3s).",
  schema: external_exports.object({ id: external_exports.string() }),
  async execute(input, ctx) {
    if (!ctx.backgroundTasks) return { ok: false, error: "no background task manager wired" };
    const ok = ctx.backgroundTasks.cancel(input.id);
    return { ok };
  }
};
var findSymbolTool = {
  name: "find_symbol",
  description: 'Locate the DEFINITION of a code symbol (function, class, interface, type, const) by name. Backed by a tree-sitter symbol graph indexed at startup. Returns the file path, 1-based line, and signature snippet.\n\nWHEN TO USE:\n  - You know the symbol name (or a substring) and want to jump to where it is defined.\n  - You want the function signature without reading the whole file.\nWHEN NOT TO USE:\n  - To find call sites \u2014 use find_references after find_symbol.\n  - For natural-language intent ("where is rate limiting?") \u2014 use semantic_search.\n  - For arbitrary text patterns \u2014 use grep_search.\n\nBEHAVIOR:\n  - Fuzzy matches by substring (case-insensitive). "build" matches buildIndex / rebuildAll.\n  - Returns up to `limit` (default 15, max 50) ranked by name closeness.\n  - Falls back to ok:false with hint if the symbol index is not yet built.\n  - parallelSafe: combine with read_file in one turn ("find then read context").',
  parallelSafe: true,
  schema: external_exports.object({
    query: external_exports.string().describe('Symbol name or substring, e.g. "buildIndex" or "User"'),
    limit: external_exports.number().int().min(1).max(50).optional()
  }),
  async execute({ query, limit = 15 }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: "code intel not available" };
    const symbols = await ctx.codeIntel.findSymbol(query, limit);
    return { ok: true, count: symbols.length, symbols };
  }
};
var findReferencesTool = {
  name: "find_references",
  description: 'Find all locations where a named symbol is referenced (called, imported, or used). Backed by the symbol graph; results are deduplicated and grouped by file.\n\nWHEN TO USE:\n  - You changed (or plan to change) a function/class signature and need to update every caller.\n  - The user asks "who uses X?".\n  - You want to assess blast radius before refactoring.\nWHEN NOT TO USE:\n  - To find the definition \u2014 use find_symbol first.\n  - For string occurrences (e.g. a CSS class name, a route path) \u2014 use grep_search; references only tracks code-level identifiers.\n\nBEHAVIOR:\n  - Match is by EXACT name. Pass the precise identifier returned by find_symbol.\n  - Returns { count, references: [{ file, line, snippet }] }.\n  - parallelSafe.',
  parallelSafe: true,
  schema: external_exports.object({
    name: external_exports.string().describe("Exact symbol name")
  }),
  async execute({ name }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: "code intel not available" };
    const refs = await ctx.codeIntel.findReferences(name);
    return { ok: true, count: refs.length, references: refs };
  }
};
var semanticSearchTool = {
  name: "semantic_search",
  description: `Hybrid (BM25 + vector + symbol graph, fused via RRF) semantic search over the codebase by NATURAL-LANGUAGE query. Returns ranked code chunks with file:line.

WHEN TO USE:
  - You don't know the exact keyword. Question-shaped queries: "where is rate limiting applied?", "how does auth refresh work?", "the place that handles file uploads".
  - Triangulating an unfamiliar codebase \u2014 use semantic_search to seed, then read_file / find_symbol for precision.
WHEN NOT TO USE:
  - You already know the literal token \u2014 grep_search is precise and faster.
  - You know the symbol name \u2014 find_symbol gives you the exact definition.
  - Looking for files by name \u2014 list_files / glob.

TIPS:
  - Phrase queries as a question or a short description, not as keywords. "function that validates JWT" beats "jwt validate".
  - k controls result count (1-20, default 8). 5-10 is the sweet spot.
  - parallelSafe: emit multiple semantic_search calls (different angles) in one turn.`,
  parallelSafe: true,
  schema: external_exports.object({
    query: external_exports.string().describe("Natural language query"),
    k: external_exports.number().int().min(1).max(20).optional()
  }),
  async execute({ query, k = 8 }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: "code intel not available" };
    const hits = await ctx.codeIntel.semanticSearch(query, k);
    return { ok: true, count: hits.length, hits };
  }
};
var listFileSymbolsTool = {
  name: "list_file_symbols",
  description: "Return an outline of all top-level symbols (functions, classes, interfaces, types, exports) defined in a single file. Like a tree view for that file.\n\nWHEN TO USE:\n  - You opened a large file and want to know its shape before reading specific sections.\n  - You need to find a method by name within a known file without reading the whole thing.\nWHEN NOT TO USE:\n  - For a workspace-wide search \u2014 use find_symbol.\n  - To read code content \u2014 use read_file with start_line/end_line; this tool only returns names + locations.\n\nBEHAVIOR: returns [{ name, kind, line }]. parallelSafe.",
  parallelSafe: true,
  schema: external_exports.object({
    path: external_exports.string().describe("Relative file path")
  }),
  async execute({ path: p }, ctx) {
    if (!ctx.codeIntel) return { ok: false, error: "code intel not available" };
    const symbols = await ctx.codeIntel.listFileSymbols(p);
    return { ok: true, count: symbols.length, symbols };
  }
};
var updatePlanTool = {
  name: "update_plan",
  description: 'Declare or update the high-level task plan that the user sees in the IDE\'s plan panel. Each call REPLACES the entire plan with the items array provided.\n\nWHEN TO USE:\n  - At the START of any task with 3+ distinct steps. Outline ALL steps up front so the user knows what you intend to do.\n  - AFTER completing each step, call again with the same items but updated statuses (mark the just-finished one completed, set the next one in_progress).\nWHEN NOT TO USE:\n  - Single-step tasks ("rename this variable", "explain this function"). Do not pollute the plan UI with trivia.\n  - To brainstorm \u2014 use the `think` tool for that.\n\nRULES:\n  - Each item: { id, content, status, priority?, parentId?, note? }. status \u2208 { pending, in_progress, completed }; priority \u2208 { high, medium, low }.\n  - Exactly ONE item should be in_progress at any time. Multiple in_progress is treated as a bug.\n  - id should be stable across updates (you are updating the SAME plan, not creating new ones).\n  - content should be 1 line, action-oriented ("Add Foo type to schema", not "Foo schema").\n  - Use parentId to nest sub-tasks under a parent (max depth 2). Useful for breaking a big step into 2-3 sub-steps.\n  - Use priority sparingly: only mark high/low when meaningful. Default is medium-equivalent (no badge).\n  - note: optional 1-line context (e.g. "blocked on lib upgrade", "see issue #123"). Keep it short.\n  - Mark a step completed IMMEDIATELY after finishing it; do not batch.\n\nparallelSafe: only emits an SSE event, no FS/exec side effects.',
  parallelSafe: true,
  schema: external_exports.object({
    items: external_exports.array(
      external_exports.object({
        id: external_exports.string(),
        content: external_exports.string(),
        status: external_exports.enum(["pending", "in_progress", "completed"]),
        priority: external_exports.enum(["high", "medium", "low"]).optional(),
        parentId: external_exports.string().optional(),
        note: external_exports.string().optional()
      })
    ),
    summary: external_exports.string().optional()
  }),
  async execute({ items, summary }, ctx) {
    if (ctx.updatePlan) {
      await ctx.updatePlan({ items, summary });
    }
    const total = items.length;
    const done = items.filter((i) => i.status === "completed").length;
    const ip = items.filter((i) => i.status === "in_progress").length;
    return { ok: true, total, completed: done, in_progress: ip };
  }
};
var verifyChangesTool = {
  name: "verify_changes",
  description: 'Run a verification step (typecheck / test / lint / custom command) and return a STRUCTURED summary of any failures. This is your self-check after editing code.\n\nWHEN TO USE:\n  - AFTER any non-trivial edit to TS/JS code \u2192 kind:"typecheck".\n  - After changes to test files \u2192 kind:"test".\n  - After config / lint-rule changes \u2192 kind:"lint".\n  - For project-specific verification (e.g. running a generator) \u2192 kind:"exec" with a command.\nWHEN NOT TO USE:\n  - To run arbitrary shell commands \u2014 use run_command (no parsing of output).\n  - For reads / explorations \u2014 verify_changes is heavy (spawns a build); use grep/read for inspection.\n\nOUTPUT (CRITICAL FOR YOU TO USE):\n  - { ok: true, summary }                         \u2192 verification passed; you can claim done.\n  - { ok: false, errors: [{ file, line, col, message }], hint, tail } \u2192 fix and re-verify.\n  - errors[] is RANKED and TRUNCATED (max 12, each msg \u2264 200 chars). Fix the FIRST 1-3; many later ones cascade.\n  - hint suggests an action ("missing import", "type mismatch", etc.). Honor it.\n  - tail contains the last ~15 lines of stderr if no structured errors were parsed.\n\nAUTO-DETECTION:\n  - typecheck \u2192 detects pnpm/yarn/npm + tsc; supports `pkg` for monorepo filters (e.g. pkg:"@mini/server").\n  - test \u2192 reads package.json and prefers vitest > jest > npm test.\n  - lint \u2192 prefers eslint . if available.\n\nDO NOT mark the user\'s task done until verify_changes returns ok:true OR you have explicitly told the user why verification was skipped.',
  // 跑命令本身是写副作用（compile cache 等），保守串行
  parallelSafe: false,
  schema: external_exports.object({
    kind: external_exports.enum(["typecheck", "test", "lint", "exec"]).describe(
      "typecheck = tsc --noEmit (auto-detect monorepo); test = pnpm test / npm test; lint = eslint .; exec = run a custom command"
    ),
    /** kind=exec 时必填，其余可选（用来覆盖默认命令） */
    command: external_exports.string().optional(),
    /** kind=typecheck/test 时可选：指定 workspace 子包 */
    pkg: external_exports.string().optional().describe('Optional pnpm workspace filter, e.g. "@mini/server"'),
    /** 超时（毫秒），默认 120000 = 2min */
    timeoutMs: external_exports.number().int().optional()
  }),
  async execute(input, ctx) {
    const kind = input.kind;
    const pkg = input.pkg;
    const custom2 = input.command;
    const timeoutMs = input.timeoutMs ?? 12e4;
    const cmd = await resolveVerifyCommand(ctx.cwd, kind, custom2, pkg);
    if (!cmd) {
      return {
        ok: false,
        skipped: true,
        reason: `Cannot determine command for kind=${kind} (no package.json / no script). Use kind:'exec' with explicit command.`
      };
    }
    const t0 = Date.now();
    let stdout = "";
    let stderr = "";
    let exitCode = 0;
    try {
      const { exec: _exec2 } = await import("node:child_process");
      const result = await new Promise(
        (resolve3) => {
          const p = _exec2(
            cmd,
            { cwd: ctx.cwd, maxBuffer: 8 * 1024 * 1024, timeout: timeoutMs },
            (err, so, se) => {
              resolve3({
                stdout: String(so ?? ""),
                stderr: String(se ?? ""),
                code: err ? err.code ?? 1 : 0
              });
            }
          );
          p.on?.("error", () => void 0);
        }
      );
      stdout = result.stdout;
      stderr = result.stderr;
      exitCode = result.code;
    } catch (e) {
      return { ok: false, summary: `process error: ${e?.message ?? e}` };
    }
    const elapsed = Date.now() - t0;
    return summarizeVerify({ kind, cmd, exitCode, stdout, stderr, elapsed });
  }
};
async function resolveVerifyCommand(cwd, kind, custom2, pkg) {
  if (kind === "exec") return custom2 ?? null;
  const hasPnpm = await fileExists(path6.join(cwd, "pnpm-workspace.yaml"));
  const pkgFile = path6.join(cwd, "package.json");
  if (!await fileExists(pkgFile)) return custom2 ?? null;
  const json = JSON.parse(await fs6.readFile(pkgFile, "utf-8"));
  const scripts = json.scripts ?? {};
  const filter = pkg ? `--filter ${pkg}` : "-r";
  if (kind === "typecheck") {
    if (custom2) return custom2;
    if (scripts.typecheck) return hasPnpm ? `pnpm ${filter} typecheck` : "npm run typecheck";
    return "npx tsc --noEmit";
  }
  if (kind === "test") {
    if (custom2) return custom2;
    if (scripts.test) return hasPnpm ? `pnpm ${filter} test` : "npm test";
    return null;
  }
  if (kind === "lint") {
    if (custom2) return custom2;
    if (scripts.lint) return hasPnpm ? `pnpm ${filter} lint` : "npm run lint";
    return "npx eslint .";
  }
  return null;
}
async function fileExists(p) {
  try {
    await fs6.access(p);
    return true;
  } catch {
    return false;
  }
}
function summarizeVerify(args) {
  const { kind, cmd, exitCode, stdout, stderr, elapsed } = args;
  const text = stdout + "\n" + stderr;
  const MAX_ERR = 12;
  const MAX_LINE = 200;
  let errors = [];
  const tscRe = /(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;
  for (const m of text.matchAll(tscRe)) {
    errors.push({
      file: m[1],
      line: Number(m[2]),
      col: Number(m[3]),
      message: `${m[5]}: ${m[6]}`.slice(0, MAX_LINE)
    });
    if (errors.length >= MAX_ERR) break;
  }
  if (errors.length === 0) {
    const lines = text.split("\n");
    let currentFile;
    for (const ln of lines) {
      const fileMatch = ln.match(/^([^\s].+\.\w+)$/);
      if (fileMatch) {
        currentFile = fileMatch[1];
        continue;
      }
      const ruleMatch = ln.match(/^\s+(\d+):(\d+)\s+(error|warning)\s+(.+?)\s+([\w/-]+)$/);
      if (ruleMatch && currentFile) {
        errors.push({
          file: currentFile,
          line: Number(ruleMatch[1]),
          col: Number(ruleMatch[2]),
          message: `${ruleMatch[4]} (${ruleMatch[5]})`.slice(0, MAX_LINE)
        });
        if (errors.length >= MAX_ERR) break;
      }
    }
  }
  if (errors.length === 0 && exitCode !== 0) {
    const tail = (stderr || stdout).split("\n").filter((l) => l.trim()).slice(-8);
    for (const ln of tail) errors.push({ message: ln.slice(0, MAX_LINE) });
  }
  const ok = exitCode === 0;
  let hint;
  if (!ok) {
    if (errors.find((e) => /Cannot find module|TS2307/.test(e.message))) {
      hint = "Module import error: check the path, file extension, and whether the dependency is installed.";
    } else if (errors.find((e) => /TS2304/.test(e.message))) {
      hint = "Undefined symbol: you probably need to add an import or define the variable before use.";
    } else if (errors.find((e) => /TS2345|TS2322/.test(e.message))) {
      hint = "Type mismatch: align argument/return types or add explicit casts. Re-read the function signature.";
    } else if (errors.length === 0) {
      hint = "Process exited non-zero but no structured errors were parsed. Inspect stderr manually with run_command or read the log.";
    } else {
      hint = `Fix the first ${Math.min(3, errors.length)} error(s); they often cascade.`;
    }
  }
  return {
    ok,
    kind,
    cmd,
    exitCode,
    elapsedMs: elapsed,
    summary: ok ? `OK (${kind}) in ${elapsed}ms` : `${errors.length}+ issue(s) (${kind}) \u2014 see errors[]`,
    errors: errors.slice(0, MAX_ERR),
    hint,
    // tail 给 LLM 看原始输出，但严格截断
    tail: ok ? void 0 : (stderr || stdout).split("\n").slice(-15).join("\n").slice(-2e3)
  };
}
var thinkTool = {
  name: "think",
  description: 'Write down your reasoning. This tool has NO side effects \u2014 it only records your thought into the trajectory so the UI can render it (often collapsed) and the model can use it as scratch space.\n\nWHEN TO USE (high-leverage scenarios):\n  - You just got an ambiguous tool result and need to decide which of several next steps to take.\n  - You are about to make a non-trivial edit and want to lay out the approach in 3-5 sentences first.\n  - You hit a tool failure and are about to retry: pause and think first about WHY it failed and what to change.\n  - The system inserted a [loop-breaker] hint \u2014 think before continuing.\nWHEN NOT TO USE:\n  - For the FINAL answer to the user \u2014 output that as normal assistant text.\n  - To stall or pad. Empty / vague thoughts ("let me think...") waste tokens.\n  - Inside other tool arguments (do NOT do `read_file({ path: "hmm I think it might be ..." })`).\n\nGUIDANCE: keep thoughts FOCUSED. Structure: (1) what I observed, (2) what it implies, (3) what I will do next. Aim for 3-8 sentences.',
  parallelSafe: true,
  schema: external_exports.object({
    thought: external_exports.string().describe(
      "Your reasoning. Keep it focused: what you observed, what the implications are, what you will do next."
    )
  }),
  async execute(input) {
    const t = String(input.thought ?? "").slice(0, 4e3);
    return { ok: true, thought: t };
  }
};
var useSkillTool = {
  name: "use_skill",
  description: 'Load the FULL body of a named skill (a curated playbook for a recurring task type). The system prompt only lists skills by name + 1-line summary; this tool fetches the detailed instructions when one matches.\n\nWHEN TO USE:\n  - The user\'s request matches a skill listed in the system prompt (e.g. user asks "review my code" and a `code-review` skill exists).\n  - You see a skill that promises to handle exactly this kind of task.\nWHEN NOT TO USE:\n  - To browse skills aimlessly \u2014 only load when one matches.\n  - Skills already loaded earlier in this conversation \u2014 reuse the previously loaded content; do not re-fetch.\n\nRETURNS:\n  - content: the full SKILL.md body (instructions you should follow).\n  - directory: absolute path to the skill folder.\n  - supportFiles: list of additional reference files in the skill folder (read with read_file using `directory` + "/" + filename).\n\nAfter loading, follow the skill\'s instructions as if they were extra system prompt for this turn.',
  parallelSafe: true,
  schema: external_exports.object({
    name: external_exports.string().describe("Exact skill name (case-sensitive) as shown in the system prompt"),
    reason: external_exports.string().optional().describe("Why you need this skill; helps with logging.")
  }),
  async execute(input, ctx) {
    const name = input.name;
    if (!ctx.skills) {
      return {
        ok: false,
        error: "Skills not configured on this server. Cannot load."
      };
    }
    const full = await ctx.skills.loadFull(name);
    if (!full) {
      const available = ctx.skills.list().map((s) => s.name).slice(0, 20).join(", ");
      return {
        ok: false,
        error: `Skill "${name}" not found. Available: ${available || "(none)"}`
      };
    }
    return {
      ok: true,
      name: full.name,
      description: full.description,
      directory: full.directory,
      supportFiles: full.supportFiles,
      content: full.body,
      hint: full.supportFiles.length > 0 ? `This skill has ${full.supportFiles.length} support files in its directory; use read_file with the absolute path (directory + "/" + file) to load any you need.` : void 0
    };
  }
};
var dispatchSubagentTool = {
  name: "dispatch_subagent",
  description: 'Spawn an independent sub-agent (its own ReAct loop, its own messages history, its own jsonl session) to handle a focused subtask. The sub-agent shares your tools (read/edit/grep) but cannot call dispatch_subagent or update_plan.\n\nWHEN TO USE:\n  - PARALLEL FAN-OUT: "add JSDoc to these 5 files" \u2192 dispatch 5 subagents, one per file. They run concurrently.\n  - CONTEXT ISOLATION: a sub-task whose exploration would dump 50KB of file contents into your context. Dispatch a subagent so the noise stays in the child trajectory.\n  - SPECIALIZED ROLE: use a project-defined subagent (.minicodeide/agents/<name>.md) for code review, test writing, etc.\n    Pass the `role` field to activate a profile \u2014 the subagent gets a role-specific system prompt and a tailored tool set.\n    Available roles: {roles}\nWHEN NOT TO USE:\n  - For trivial reads/edits \u2014 just do it inline; spawning is expensive (extra LLM call, context warm-up).\n  - For tasks needing the parent\'s full context \u2014 the child starts blank.\n  - In a child agent (already nested) \u2014 nesting beyond depth 2 is blocked.\n\nPROTOCOL (PUSH, NOT POLL):\n  - Returns IMMEDIATELY with { runId, childSessionId }. Do NOT wait, do NOT poll.\n  - When the subagent finishes, the system pushes a synthetic user message to YOU containing its result: "[Subagent Completed] <label>\\n<result>".\n  - Continue your work in the meantime. The result will arrive as a normal turn boundary.\n\nTASK QUALITY:\n  - The `task` field IS the subagent\'s user message. Make it self-contained: include file paths, success criteria, and any context the subagent needs (it cannot see your conversation).\n  - Bad:  "review this"  \u2014 Good: "Review packages/core/src/agent/loop.ts for bugs in the retry logic. Output a list of issues with line numbers, no rewrites."\n  - `label` (optional, short) is shown in the IDE\'s subagent panel to help the user track which child is which.',
  parallelSafe: false,
  // 串行 spawn，避免一次性触发 5 个 LLM 调用
  schema: external_exports.object({
    task: external_exports.string().describe("The focused task description sent to the sub-agent as user message"),
    label: external_exports.string().optional().describe('Short label for tracking (e.g. "review-foo.ts")'),
    role: external_exports.string().optional().describe('Role profile name from .minicodeide/agents/<name>.md \u2014 e.g. "code-reviewer", "test-writer", "debugger". If omitted, uses the default subagent prompt.')
  }),
  async execute(input, ctx) {
    if (!ctx.dispatchSubagent) {
      return { ok: false, error: "Subagent dispatch not available on this server" };
    }
    const depth = ctx.subagentDepth ?? 0;
    if (depth >= 2) {
      return { ok: false, error: `Subagent nesting depth limit reached (${depth})` };
    }
    const { task, label, role } = input;
    try {
      const r = await ctx.dispatchSubagent({ task, label, role });
      return {
        ok: true,
        runId: r.runId,
        childSessionId: r.childSessionId,
        note: 'Sub-agent dispatched. Result will arrive as a "[Subagent Completed]" user message. Do not call list_sessions / sleep / poll. Continue with other work or wait.'
      };
    } catch (e) {
      return { ok: false, error: e?.message ?? String(e) };
    }
  }
};
function registerBuiltinTools(registry) {
  registry.register(readFileTool).register(writeFileTool).register(editFileTool).register(listFilesTool).register(grepTool).register(runCommandTool).register(listBackgroundTasksTool).register(getBackgroundResultTool).register(cancelBackgroundTaskTool).register(findSymbolTool).register(findReferencesTool).register(semanticSearchTool).register(listFileSymbolsTool).register(updatePlanTool).register(verifyChangesTool).register(useSkillTool).register(thinkTool).register(webFetchTool).register(applyPatchTool).register(gitStatusTool).register(gitDiffTool).register(gitLogTool).register(gitBranchTool).register(gitCommitTool).register(dispatchSubagentTool).register(readImageTool).register(screenshotTool);
  return registry;
}

// ../../packages/core/src/agent/agent-profiles.ts
import { promises as fs7 } from "node:fs";
import path7 from "node:path";
function parseFrontMatter(raw) {
  const trimmed = raw.trimStart();
  if (!trimmed.startsWith("---")) {
    return { attrs: {}, body: raw };
  }
  const end = trimmed.indexOf("---", 3);
  if (end === -1) return { attrs: {}, body: raw };
  const fmStr = trimmed.slice(3, end).trim();
  const body = trimmed.slice(end + 3).trim();
  const attrs = {};
  for (const line of fmStr.split("\n")) {
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const key = line.slice(0, colonIdx).trim();
    let val = line.slice(colonIdx + 1).trim();
    if (typeof val === "string" && val.startsWith("[") && val.endsWith("]")) {
      val = val.slice(1, -1).split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
    }
    if (val === "true") val = true;
    if (val === "false") val = false;
    if (typeof val === "string" && /^\d+$/.test(val)) val = Number(val);
    attrs[key] = val;
  }
  return { attrs, body };
}
function attrsToStringArray(v) {
  if (Array.isArray(v)) return v.map(String);
  if (typeof v === "string") return v.split(",").map((s) => s.trim()).filter(Boolean);
  return void 0;
}
function rawToProfile(raw, filePath) {
  const { attrs, body } = parseFrontMatter(raw);
  const nameFromPath = path7.basename(filePath, ".md");
  return {
    name: attrs.name ?? nameFromPath,
    description: attrs.description ?? "",
    allowedTools: attrsToStringArray(attrs.allowed_tools ?? attrs.allowedTools),
    deniedTools: attrsToStringArray(attrs.denied_tools ?? attrs.deniedTools),
    sandbox: attrs.sandbox ?? void 0,
    maxSteps: typeof attrs.max_steps === "number" ? attrs.max_steps : typeof attrs.maxSteps === "number" ? attrs.maxSteps : void 0,
    systemPrompt: body,
    sourceFile: filePath
  };
}
async function loadAgentProfiles(workspaceRoot) {
  const profiles = /* @__PURE__ */ new Map();
  const agentsDir = path7.join(workspaceRoot, ".minicodeide", "agents");
  let entries;
  try {
    entries = await fs7.readdir(agentsDir);
  } catch {
    return profiles;
  }
  for (const entry of entries) {
    if (!entry.endsWith(".md")) continue;
    const fp = path7.join(agentsDir, entry);
    try {
      const raw = await fs7.readFile(fp, "utf-8");
      const profile = rawToProfile(raw, fp);
      profiles.set(profile.name, profile);
    } catch {
    }
  }
  return profiles;
}
function getProfile(profiles, roleName) {
  return profiles.get(roleName);
}

// ../../packages/core/src/memory/store.ts
import { promises as fs8 } from "node:fs";
import path8 from "node:path";
import os from "node:os";
var NOW = () => Date.now();
var DAY_MS = 24 * 60 * 60 * 1e3;
function decayFactor(lastHitAt, now) {
  if (!lastHitAt) return 1;
  const daysSinceHit = (now - lastHitAt) / DAY_MS;
  if (daysSinceHit <= 30) return 1;
  const halfLives = (daysSinceHit - 30) / 30;
  return Math.max(0.1, Math.pow(0.5, halfLives));
}
function tokenize(s) {
  if (!s) return [];
  const lo = s.toLowerCase();
  const out = [];
  for (const m of lo.matchAll(/[a-z0-9_]{2,}/g)) out.push(m[0]);
  const cjk = [...lo].filter((c) => /[\u4e00-\u9fff]/.test(c));
  for (let i = 0; i < cjk.length; i++) {
    out.push(cjk[i]);
    if (i + 1 < cjk.length) out.push(cjk[i] + cjk[i + 1]);
  }
  return out;
}
async function atomicWrite(file, content) {
  await fs8.mkdir(path8.dirname(file), { recursive: true });
  const tmp = `${file}.tmp.${process.pid}.${Date.now()}`;
  await fs8.writeFile(tmp, content, "utf-8");
  await fs8.rename(tmp, file);
}
var MemoryStore = class {
  constructor(opts) {
    this.opts = opts;
    this.rootDir = opts.rootDir ?? path8.join(os.homedir(), ".minicodeide");
    const hash = simpleHash(opts.projectPath);
    this.projectDir = path8.join(this.rootDir, "projects", hash);
    this.embedder = opts.embedder;
  }
  opts;
  rootDir;
  projectDir;
  embedder;
  /** 运行时切换 embedder（provider 切换时调用） */
  setEmbedder(emb) {
    this.embedder = emb;
  }
  file(scope) {
    return scope === "user" ? path8.join(this.rootDir, "user", "memories.json") : path8.join(this.projectDir, "memories.json");
  }
  async readAll(scope) {
    const file = this.file(scope);
    try {
      const txt = await fs8.readFile(file, "utf-8");
      const arr = JSON.parse(txt);
      return arr.map((m) => ({
        ...m,
        importance: m.importance ?? 3,
        source: m.source ?? "user"
      }));
    } catch {
      return [];
    }
  }
  async writeAll(scope, items) {
    await atomicWrite(this.file(scope), JSON.stringify(items, null, 2));
  }
  async list(scope, includeArchived = false) {
    const all = await this.readAll(scope);
    return includeArchived ? all : all.filter((m) => !m.archived);
  }
  async upsert(scope, item) {
    const all = await this.readAll(scope);
    const now = NOW();
    let target = item.id ? all.find((x) => x.id === item.id) : void 0;
    if (target) {
      Object.assign(target, item, { updatedAt: now });
    } else {
      target = {
        id: item.id ?? `mem_${now}_${Math.random().toString(36).slice(2, 6)}`,
        scope,
        category: item.category,
        title: item.title,
        content: item.content,
        keywords: item.keywords ?? [],
        importance: item.importance ?? 3,
        createdAt: now,
        updatedAt: now,
        hitCount: 0,
        source: item.source ?? "user",
        archived: false
      };
      all.push(target);
    }
    if (this.embedder) {
      try {
        const text = `${target.title}
${target.content}
${target.keywords.join(" ")}`;
        const [vec] = await this.embedder.embed([text]);
        if (vec && vec.length > 0) {
          target.vec = Array.from(vec);
          target.vecModel = this.embedder.name ?? "embedder";
        }
      } catch {
      }
    }
    await this.writeAll(scope, all);
    return target;
  }
  async delete(scope, id) {
    const all = await this.readAll(scope);
    const next = all.filter((x) => x.id !== id);
    if (next.length === all.length) return false;
    await this.writeAll(scope, next);
    return true;
  }
  /**
   * 召回（升级版 v3）：
   *   - 词法分支：score = sum_token(idfApprox * tf) * importance * decay
   *   - 语义分支（embedder 可用时）：cosine(query_vec, item.vec) * importance * decay
   *   - 二者用 Reciprocal Rank Fusion 融合，k=60（与 retrieval.ts 一致）
   *
   * 没有 embedder 或 query embed 失败 → 自动降级为纯词法（行为兼容旧版）
   */
  async recall(query, opts = {}) {
    const topK = opts.topK ?? 5;
    const excludeArchived = opts.excludeArchived !== false;
    const trackHits = opts.trackHits !== false;
    const userMems = await this.readAll("user");
    const projMems = await this.readAll("project");
    const merged = [...userMems, ...projMems].filter((m) => excludeArchived ? !m.archived : true);
    if (!merged.length) return [];
    const now = NOW();
    const lexicalRanked = this.scoreLexical(query, merged, now);
    let semanticRanked = [];
    if (this.embedder && merged.some((m) => m.vec && m.vec.length > 0)) {
      try {
        const [qVec] = await this.embedder.embed([query]);
        if (qVec && qVec.length > 0) {
          semanticRanked = merged.map((m) => {
            if (!m.vec || m.vec.length !== qVec.length) return { m, score: 0 };
            const sim = cosine(qVec, m.vec);
            if (sim <= 0) return { m, score: 0 };
            const imp = Math.max(1, Math.min(5, m.importance)) / 3;
            const dec = decayFactor(m.lastHitAt, now);
            return { m, score: sim * imp * dec };
          }).filter((x) => x.score > 0).sort((a, b) => b.score - a.score);
        }
      } catch {
      }
    }
    let final;
    if (semanticRanked.length === 0) {
      final = lexicalRanked.slice(0, topK).map((s) => s.m);
    } else {
      const RRF_K = 60;
      const fused = /* @__PURE__ */ new Map();
      lexicalRanked.forEach((s, rank) => {
        fused.set(s.m.id, { m: s.m, score: 1 / (RRF_K + rank + 1) });
      });
      semanticRanked.forEach((s, rank) => {
        const existing = fused.get(s.m.id);
        const r = 1 / (RRF_K + rank + 1);
        if (existing) existing.score += r;
        else fused.set(s.m.id, { m: s.m, score: r });
      });
      final = [...fused.values()].sort((a, b) => b.score - a.score).slice(0, topK).map((x) => x.m);
    }
    if (final.length && trackHits) {
      this.trackHitsBg(final, now).catch(() => void 0);
    }
    return final;
  }
  /** 词法打分（旧版逻辑提出来，便于复用） */
  scoreLexical(query, items, now) {
    const qTokens = tokenize(query);
    if (!qTokens.length) return [];
    const scored = items.map((m) => {
      const blob = `${m.title} ${m.title} ${m.content} ${m.keywords.join(" ")}`;
      const dTokens = tokenize(blob);
      const dCount = {};
      for (const t of dTokens) dCount[t] = (dCount[t] ?? 0) + 1;
      let raw = 0;
      const seen = /* @__PURE__ */ new Set();
      for (const t of qTokens) {
        if (seen.has(t)) continue;
        seen.add(t);
        const tf = dCount[t] ?? 0;
        if (tf === 0) continue;
        const idf = t.length >= 3 ? 1.5 : 1;
        raw += idf * Math.log(1 + tf);
      }
      if (raw === 0) return { m, score: 0 };
      const imp = Math.max(1, Math.min(5, m.importance)) / 3;
      const dec = decayFactor(m.lastHitAt, now);
      return { m, score: raw * imp * dec };
    });
    return scored.filter((s) => s.score > 0).sort((a, b) => b.score - a.score);
  }
  /**
   * 给已有 memory 批量补 embedding（用户切换 embedder 或首次启用时跑一次）。
   * 没配 embedder → 直接返回 {scanned:0, embedded:0}
   */
  async reembedAll() {
    if (!this.embedder) return { scanned: 0, embedded: 0 };
    let scanned = 0;
    let embedded = 0;
    const targetModel = this.embedder.name ?? "embedder";
    for (const scope of ["user", "project"]) {
      const all = await this.readAll(scope);
      const need = all.filter((m) => !m.archived && (!m.vec || m.vecModel !== targetModel));
      if (!need.length) {
        scanned += all.length;
        continue;
      }
      const BATCH = 32;
      for (let i = 0; i < need.length; i += BATCH) {
        const batch = need.slice(i, i + BATCH);
        try {
          const vecs = await this.embedder.embed(
            batch.map((m) => `${m.title}
${m.content}
${m.keywords.join(" ")}`)
          );
          for (let j = 0; j < batch.length; j++) {
            const v = vecs[j];
            if (v && v.length > 0) {
              batch[j].vec = Array.from(v);
              batch[j].vecModel = targetModel;
              embedded++;
            }
          }
        } catch {
        }
      }
      scanned += all.length;
      await this.writeAll(scope, all);
    }
    return { scanned, embedded };
  }
  async trackHitsBg(hits, now) {
    const hitIds = new Set(hits.map((h) => h.id));
    for (const scope of ["user", "project"]) {
      const all = await this.readAll(scope);
      let changed = false;
      for (const m of all) {
        if (hitIds.has(m.id)) {
          m.hitCount++;
          m.lastHitAt = now;
          changed = true;
        }
      }
      if (changed) await this.writeAll(scope, all);
    }
  }
  /**
   * 维护任务（建议每天跑一次 / 启动时跑一次）：
   *   1. 归档 30+ 天未命中且 hitCount<2 的 (低价值) 记忆 → archived=true，不再召回
   *   2. 去重：title+content 高度相似 → 保留 hitCount/importance 高的，归档其它
   * 返回统计信息便于报告。
   */
  async maintain(opts = {}) {
    const staleDays = opts.staleDays ?? 90;
    const staleHitMax = opts.staleHitMax ?? 1;
    const dedupThreshold = opts.dedupThreshold ?? 0.85;
    const now = NOW();
    const report = { archivedStale: 0, archivedDup: 0, scanned: 0 };
    for (const scope of ["user", "project"]) {
      const all = await this.readAll(scope);
      let dirty = false;
      for (const m of all) {
        if (m.archived) continue;
        report.scanned++;
        const hitAt = m.lastHitAt ?? m.createdAt;
        const days = (now - hitAt) / DAY_MS;
        if (days > staleDays && m.hitCount <= staleHitMax) {
          m.archived = true;
          report.archivedStale++;
          dirty = true;
        }
      }
      const active = all.filter((m) => !m.archived);
      for (let i = 0; i < active.length; i++) {
        for (let j = i + 1; j < active.length; j++) {
          if (active[i].archived || active[j].archived) continue;
          const sim = similarity(active[i], active[j]);
          if (sim >= dedupThreshold) {
            const scoreI = active[i].importance * (1 + active[i].hitCount);
            const scoreJ = active[j].importance * (1 + active[j].hitCount);
            const loser = scoreI >= scoreJ ? active[j] : active[i];
            loser.archived = true;
            report.archivedDup++;
            dirty = true;
          }
        }
      }
      if (dirty) await this.writeAll(scope, all);
    }
    return report;
  }
};
function similarity(a, b) {
  const sa = new Set(tokenize(a.title + " " + a.content));
  const sb = new Set(tokenize(b.title + " " + b.content));
  if (sa.size === 0 || sb.size === 0) return 0;
  let inter = 0;
  for (const x of sa) if (sb.has(x)) inter++;
  const union = sa.size + sb.size - inter;
  return inter / union;
}
function cosine(a, b) {
  const n = Math.min(a.length, b.length);
  if (n === 0) return 0;
  let dot = 0;
  let na = 0;
  let nb = 0;
  for (let i = 0; i < n; i++) {
    const x = a[i];
    const y = b[i];
    dot += x * y;
    na += x * x;
    nb += y * y;
  }
  const denom = Math.sqrt(na) * Math.sqrt(nb);
  return denom === 0 ? 0 : dot / denom;
}
function simpleHash(s) {
  let h = 5381;
  for (let i = 0; i < s.length; i++) h = (h << 5) + h ^ s.charCodeAt(i);
  return (h >>> 0).toString(36);
}

// ../../packages/core/src/memory/auto-memory.ts
init_zod();
var lastRunBySession = /* @__PURE__ */ new Map();
var MIN_TURNS_BETWEEN_RUNS = 3;
var MIN_USER_LEN = 20;
function shouldRun(userMessage) {
  if (userMessage.length < MIN_USER_LEN) return false;
  const signals = [
    // 偏好信号（原有）
    /\b(prefer|like|don'?t like|hate|always|never|please|stop|remember|note that)\b/i,
    /我(希望|喜欢|不喜欢|讨厌|总是|从不|不要|要求|偏好|习惯)/,
    /(以后|今后|下次|always|永远|每次|每个|all|every)/i,
    /\b(rule|convention|standard|coding style)\b/i,
    /(规范|约定|惯例|风格|要求|强制)/,
    /\b(use|don'?t use|switch to)\b.*\b(library|framework|tool|version)\b/i,
    /(用|不用|改用|换成).*(库|框架|版本|工具|API)/,
    /\b(deprecated|legacy|migrate|deprecat)/i,
    // 项目知识信号（新增）
    /(这个项目|该项目|本项目|我们的项目)/,
    /(入口(是|在|文件)|主文件是|main\s+(is|file))/i,
    /(架构(是|如下)|目录结构|项目结构|模块划分)/,
    /(数据库(是|用的)|数据库连接|DB\s+(is|uses))/i,
    /(部署在|运行在|服务器是|端口是)/,
    /(\.env|环境变量|config\s+file|配置文件)\s*(里|中|是|有)/,
    /(token\s+limit|context\s+window|模型(是|用的|换成))/i,
    // 用户显式要求记住（/remember 会在 slash-commands 里处理，这里是自然语言兜底）
    /\b(remember|记住|记一下|记录一下|别忘了)\b/i,
    /(帮我记|你需要记|你应该记|记好了)/
  ];
  return signals.some((re) => re.test(userMessage));
}
function rateLimitOk(sessionId) {
  if (!sessionId) return true;
  const last = lastRunBySession.get(sessionId) ?? 0;
  return Date.now() - last > MIN_TURNS_BETWEEN_RUNS * 1e3;
}
async function considerAutoMemory(ctx) {
  try {
    if (!shouldRun(ctx.userMessage)) return 0;
    if (!rateLimitOk(ctx.sessionId)) return 0;
    if (ctx.sessionId) lastRunBySession.set(ctx.sessionId, Date.now());
    const items = await extractMemoriesViaLLM(ctx);
    if (!items.length) return 0;
    let saved = 0;
    for (const it of items) {
      const scope = it.category === "project_knowledge" ? "project" : "user";
      try {
        await ctx.memory.upsert(scope, {
          title: it.title.slice(0, 100),
          content: it.content.slice(0, 1e3),
          category: it.category,
          keywords: (it.keywords ?? []).slice(0, 8),
          importance: Math.max(1, Math.min(5, it.importance ?? 4)),
          source: "auto"
        });
        saved++;
        ctx.onSaved?.({ title: it.title, category: it.category, scope });
      } catch {
      }
    }
    return saved;
  } catch {
    return 0;
  }
}
var AutoMemorySchema = external_exports.object({
  items: external_exports.array(
    external_exports.object({
      title: external_exports.string().min(1).max(120),
      content: external_exports.string().min(1).max(1200),
      category: external_exports.enum(["user_preference", "project_knowledge", "experience", "task_pattern"]),
      keywords: external_exports.array(external_exports.string()).optional(),
      importance: external_exports.number().min(1).max(5).optional()
    })
  )
});
var PROMPT_SYS = `You are a memory extraction agent. Read the user message and the assistant's reply, and decide if the user has revealed any LONG-TERM-USEFUL information worth remembering.

Output JSON with shape {"items":[...]} (empty array if nothing worth remembering).

Rules:
- If nothing worth remembering, output {"items":[]}.
- Be CONSERVATIVE: prefer empty over false positives.
- NEVER record one-off task details (e.g. "fix bug in foo.ts" - that's not memory-worthy).
- DO record stable facts: coding style preferences, tech stack decisions, project conventions, recurring pain points.
- importance: 5=core convention/policy, 4=stable preference, 3=useful note, 2=mild hint, 1=trivia.
- category must be one of: user_preference | project_knowledge | experience | task_pattern.`;
async function extractMemoriesViaLLM(ctx) {
  const userMsg = ctx.userMessage.slice(0, 2e3);
  const reply = (ctx.assistantReply ?? "").slice(0, 800);
  const userBlock = `<user-msg>
${userMsg}
</user-msg>
<assistant-reply>
${reply}
</assistant-reply>`;
  try {
    const { data } = await callStructured(ctx.llm, {
      schema: AutoMemorySchema,
      messages: [
        { role: "system", content: PROMPT_SYS },
        { role: "user", content: userBlock }
      ],
      model: ctx.model,
      temperature: 0,
      // 失败 1 次重试就够：auto-memory 是 best-effort 后台任务，不值得烧多次 token
      maxRetries: 1,
      schemaName: "auto_memory_items"
    });
    return data.items;
  } catch {
    return [];
  }
}

// ../../packages/core/src/context/token-estimator.ts
var DEFAULT_TOKEN_ESTIMATE = {
  cjkCharsPerToken: 1.35,
  otherCharsPerToken: 4,
  safetyMargin: 1.2
};
function splitScriptCharCounts(text) {
  let cjk = 0;
  let other = 0;
  for (const ch of text) {
    const cp = ch.codePointAt(0);
    if (cp >= 19968 && cp <= 40959 || cp >= 13312 && cp <= 19903 || cp >= 12352 && cp <= 12447 || cp >= 12448 && cp <= 12543 || cp >= 44032 && cp <= 55215) {
      cjk++;
    } else {
      other++;
    }
  }
  return { cjk, other };
}
function estimateTextTokens(text, opts = {}) {
  if (!text) return 0;
  if (opts.tokenizer) {
    return opts.tokenizer(text);
  }
  const cjkCharsPerToken = opts.cjkCharsPerToken ?? DEFAULT_TOKEN_ESTIMATE.cjkCharsPerToken;
  const otherCharsPerToken = opts.otherCharsPerToken ?? DEFAULT_TOKEN_ESTIMATE.otherCharsPerToken;
  const safetyMargin = opts.safetyMargin ?? DEFAULT_TOKEN_ESTIMATE.safetyMargin;
  const { cjk, other } = splitScriptCharCounts(text);
  const raw = cjk / cjkCharsPerToken + other / otherCharsPerToken;
  return Math.ceil(raw * safetyMargin);
}
function estimateMessageTokens(msg, opts = {}) {
  const PER_MESSAGE_OVERHEAD = 4;
  let total = PER_MESSAGE_OVERHEAD;
  if (msg.content) total += estimateTextTokens(msg.content, opts);
  if (msg.name) total += estimateTextTokens(msg.name, opts);
  if (msg.tool_calls) {
    for (const tc of msg.tool_calls) {
      if (tc.name) total += estimateTextTokens(tc.name, opts);
      if (tc.arguments !== void 0) {
        const s = typeof tc.arguments === "string" ? tc.arguments : JSON.stringify(tc.arguments);
        total += estimateTextTokens(s, opts);
      }
    }
  }
  return total;
}
function estimateMessagesTokens(msgs, opts = {}) {
  let s = 0;
  for (const m of msgs) s += estimateMessageTokens(m, opts);
  return s;
}
var MODEL_CONTEXT_WINDOWS = {
  "gpt-4o": 128e3,
  "gpt-4o-mini": 128e3,
  "gpt-4-turbo": 128e3,
  "o1": 2e5,
  "o1-mini": 128e3,
  "claude-3-5-sonnet": 2e5,
  "claude-3-5-sonnet-latest": 2e5,
  "claude-sonnet-4": 2e5,
  "claude-3-7-sonnet": 2e5,
  "deepseek-chat": 128e3,
  "deepseek-coder": 128e3,
  "moonshot-v1-128k": 128e3,
  "moonshot-v1-32k": 32e3,
  "moonshot-v1-8k": 8e3,
  default: 32e3
};
function getContextWindow(model) {
  if (!model) return MODEL_CONTEXT_WINDOWS.default;
  if (MODEL_CONTEXT_WINDOWS[model]) return MODEL_CONTEXT_WINDOWS[model];
  for (const k of Object.keys(MODEL_CONTEXT_WINDOWS)) {
    if (k !== "default" && model.startsWith(k)) return MODEL_CONTEXT_WINDOWS[k];
  }
  return MODEL_CONTEXT_WINDOWS.default;
}
function resolveCompactionThresholds(model, override, tokenOpts) {
  const contextWindow = tokenOpts?.contextWindowOverride ?? getContextWindow(model);
  const triggerRatio = override?.triggerRatio ?? 0.9;
  const targetRatio = override?.targetRatio ?? 0.5;
  const triggerMaxTokens = override?.triggerMaxTokens ?? 165e3;
  const triggerTokens = Math.min(Math.floor(contextWindow * triggerRatio), triggerMaxTokens);
  const targetTokens = Math.floor(contextWindow * targetRatio);
  return { contextWindow, triggerTokens, targetTokens };
}

// ../../packages/core/src/context/compactor.ts
async function compactHistory(history, opts = {}) {
  const thresholds = resolveCompactionThresholds(opts.model, opts.thresholds, opts.tokenOpts);
  const tokenOpts = opts.tokenOpts;
  const reserved = opts.reservedTokens ?? 0;
  const headKeep = opts.headKeep ?? 2;
  const tailMinUserMessages = opts.tailMinUserMessages ?? 5;
  const beforeTokens = estimateMessagesTokens(history, tokenOpts) + reserved;
  if (beforeTokens < thresholds.triggerTokens || history.length <= headKeep + 2) {
    return {
      messages: history,
      thresholds,
      beforeTokens,
      afterTokens: beforeTokens,
      compacted: false
    };
  }
  const head = history.slice(0, Math.min(headKeep, history.length));
  const headTokens = estimateMessagesTokens(head, tokenOpts);
  const SUMMARY_BUDGET = 500;
  const tailBudget = Math.max(
    1e3,
    thresholds.targetTokens - reserved - headTokens - SUMMARY_BUDGET
  );
  const tail = [];
  let tailTokens = 0;
  let userMsgInTail = 0;
  for (let i = history.length - 1; i >= head.length; i--) {
    const m = history[i];
    const t = estimateMessageTokens(m, tokenOpts);
    if (tailTokens + t > tailBudget && userMsgInTail >= tailMinUserMessages) break;
    tail.unshift(m);
    tailTokens += t;
    if (m.role === "user" || m.role === "assistant") userMsgInTail++;
  }
  while (tail.length > 0 && tail[0].role === "tool") {
    tail.shift();
  }
  let safeHead = head.slice();
  while (safeHead.length > 0) {
    const last = safeHead[safeHead.length - 1];
    if (last.role === "assistant" && last.tool_calls?.length) {
      safeHead.pop();
    } else {
      break;
    }
  }
  const middle = history.slice(safeHead.length, history.length - tail.length);
  if (middle.length === 0) {
    return {
      messages: [...safeHead, ...tail],
      thresholds,
      beforeTokens,
      afterTokens: estimateMessagesTokens([...safeHead, ...tail], tokenOpts) + reserved,
      compacted: false
    };
  }
  let summaryText;
  try {
    if (opts.summarize) {
      summaryText = await opts.summarize(middle);
    } else {
      summaryText = fallbackSummary(middle);
    }
  } catch (err) {
    summaryText = fallbackSummary(middle, err);
  }
  const summaryMsg = {
    role: "system",
    content: `[Compacted ${middle.length} earlier messages \u2014 short-term \u2192 long-term memory transition]
${summaryText}
(IMPORTANT: keep this system message in subsequent compactions)`
  };
  const out = [...safeHead, summaryMsg, ...tail];
  const afterTokens = estimateMessagesTokens(out, tokenOpts) + reserved;
  return {
    messages: out,
    thresholds,
    beforeTokens,
    afterTokens,
    compacted: true,
    summaryText
  };
}
function fallbackSummary(middle, err) {
  const lines = [];
  if (err) lines.push(`(L2 summarizer failed: ${err?.message ?? err}, using heuristic fallback)`);
  const paths = /* @__PURE__ */ new Set();
  const errors = [];
  const decisions = [];
  for (const m of middle) {
    const txt = (m.content ?? "").toString();
    for (const p of txt.matchAll(/[\w./-]+\.[a-zA-Z]{1,5}\b/g)) {
      if (paths.size < 30) paths.add(p[0]);
    }
    for (const e of txt.matchAll(/(?:Error|error|failed|exception)[:\s][^\n]{0,200}/gi)) {
      if (errors.length < 5) errors.push(e[0].slice(0, 200));
    }
    for (const d of txt.matchAll(/(?:I will|I'll|让我|我决定|Let's|Let me|TODO)[^\n.]{0,200}/gi)) {
      if (decisions.length < 5) decisions.push(d[0].slice(0, 200));
    }
  }
  if (paths.size) lines.push(`Files mentioned: ${[...paths].slice(0, 20).join(", ")}`);
  if (errors.length) lines.push(`Errors observed:
  - ${errors.join("\n  - ")}`);
  if (decisions.length) lines.push(`Key actions/decisions:
  - ${decisions.join("\n  - ")}`);
  if (!lines.length) {
    lines.push(`(${middle.length} messages truncated, no extractable signals)`);
  }
  return lines.join("\n");
}

// ../../packages/core/src/prompts/sections/identity.ts
function IDENTITY(opts) {
  const lines = [];
  lines.push(
    "You are MiniCodeIDE, an AI coding agent embedded in a local IDE. You and the user share the same workspace and collaborate to achieve their goals. You help them read, navigate, refactor, and reason about their codebase by calling tools."
  );
  lines.push(
    'You are running inside the IDE \u2014 the user can see the same files you can see. Do NOT tell the user to "save this file to /tmp/foo" or "copy this snippet" \u2014 they have direct access to whatever you write.'
  );
  if (opts.cwd) lines.push(`Working directory: ${opts.cwd}`);
  if (opts.os) lines.push(`Host OS: ${opts.os}`);
  lines.push(
    `You are NOT a general-purpose chatbot. Stay focused on the user's code and project. If asked who you are, say "MiniCodeIDE" \u2014 do not claim to be Claude, GPT, or any other product.`
  );
  return lines.join("\n");
}

// ../../packages/core/src/prompts/sections/tone.ts
function TONE(opts) {
  const base = [
    "## Tone & Style",
    "- Match the user's language: reply in Chinese if they write Chinese; English if they write English. Never mix.",
    '- No filler ("Sure!", "Of course!", "Great question!"). No self-summary at the end. No "let me know if you need more help".',
    "- Be direct and objective. Do NOT validate the user's belief just to be agreeable. If the user is wrong, say so with evidence.",
    "- Only use emojis if the user explicitly asks for them."
  ];
  base.push(
    "",
    "## Final Answer Formatting Rules",
    "- Use GitHub-flavored Markdown sparingly. Match structure to task complexity: simple task \u2192 one-liner answer.",
    "- Headers are OPTIONAL. If used, short Title Case (1-3 words) wrapped in **\u2026**, no blank line after.",
    "- **Lists are FLAT**. Do NOT nest bullets. If you need hierarchy, split into separate sections or use a `:` followed by an inline continuation.",
    "- Numbered lists use `1.` `2.` `3.` (with period), never `1)`.",
    "- Use backticks for paths, env vars, command names, identifiers, and short literals.",
    "- Multi-line snippets go in fenced code blocks with an info string (` ```ts `).",
    "",
    "## Code/File References",
    'Each reference must stand alone (don\'t collapse "see also `foo.ts`, `bar.ts`" \u2014 write each).',
    "Accepted formats:",
    "  - `src/app.ts` (workspace-relative)",
    "  - `src/app.ts:42`            (line)",
    "  - `src/app.ts:42:5`          (line:column, 1-based)",
    "  - `src/app.ts#L42`           (alt syntax)",
    "  - bare filename if unambiguous: `app.ts:42`",
    "Do NOT use `file://`, `vscode://`, or `https://` URIs. Do NOT give line ranges (`:10-20` is wrong; pick the most relevant single line)."
  );
  if (opts.style === "concise") {
    base.push(
      "",
      "## Length",
      "- Default to **concise**: \u2264 4 lines of prose unless code is needed or the user asked for detail.",
      '- For factual lookups ("which file defines X?") answer in 1 line + a `path:line` reference.',
      "- For complex changes: state the solution first, then walk the user through what you did and why (still concise)."
    );
  } else if (opts.style === "explanatory") {
    base.push(
      "",
      "## Length",
      "- Default to **explanatory**: after each non-trivial change, briefly explain *why* in 1-2 sentences.",
      "- Highlight trade-offs when relevant."
    );
  } else {
    base.push(
      "",
      "## Length",
      "- Default to **verbose**: walk through reasoning, list alternatives considered, explain trade-offs."
    );
  }
  if (opts.provider === "anthropic") {
    base.push(
      "",
      "## Anthropic-specific",
      "- You are highly capable: solve the problem without unnecessarily asking the user for input.",
      "- Use the planning tool VERY FREQUENTLY. Mark items completed IMMEDIATELY when done \u2014 do not batch.",
      '- For broad codebase exploration ("how is auth structured?"), delegate to a sub-agent (`dispatch_subagent`) instead of running 10 grep calls in your own context.'
    );
  } else if (opts.provider === "openai") {
    base.push(
      "",
      "## Codex-specific",
      "- Prefer `rg` / `rg --files` over `grep` / `find` for shell-based search.",
      "- Try `apply_patch` for single-file edits when available; fall back to other strategies for auto-generated files or codebase-wide replacements."
    );
  }
  return base.join("\n");
}

// ../../packages/core/src/prompts/sections/conventions.ts
var CONVENTIONS = [
  "## Following Codebase Conventions",
  "",
  "### Read before write",
  "- Before editing or adding code, read 1-2 nearby files to learn the import style, naming conventions, and patterns. DO NOT assume.",
  "- Match the existing style precisely. If the project uses ESM with `.js` extensions, do the same. If it uses 2-space indent, do not switch to 4. If single quotes, do not switch to double.",
  "- ALWAYS prefer EDITING an existing file over CREATING a new one. NEVER create files unless absolutely necessary for achieving the goal \u2014 this includes markdown / README / docs files.",
  "",
  "### Dependencies & utilities",
  '- DO NOT invent dependencies. Check `package.json` (or `requirements.txt`, `Cargo.toml`, `go.mod`, etc.) before using a library. If unsure, grep for `import .* from "<lib>"` first.',
  "- Reuse existing utilities. If the project has a `formatDate` helper, use it. Search for similar functionality before adding new.",
  "- Respect existing abstractions. Do not refactor adjacent code unless asked. Stay scoped to the user's request.",
  "",
  "### Comments & artifacts",
  '- DO NOT add comments unless asked or unless the code is not self-explanatory. Especially: NO "added by AI", "this is the new code", "// TODO: ask user" placeholders.',
  "- Default to ASCII when editing or creating files. Only use non-ASCII characters when the file already uses them OR there is a clear justification.",
  "- Add tests if test patterns exist in the project; if not, do not invent a testing framework.",
  "",
  "### Git etiquette",
  "- The worktree may be dirty. NEVER revert existing changes you didn't make unless explicitly asked \u2014 those are the user's work.",
  "- If you notice unexpected file changes you didn't make, STOP and ask the user how to proceed.",
  "- NEVER use destructive git commands (`git reset --hard`, `git checkout --`, `git push --force`) unless explicitly approved.",
  "- Prefer non-interactive git commands (avoid `git rebase -i`, `git commit -a`). The interactive console will likely hang.",
  "- Do NOT amend a commit unless explicitly requested.",
  "- Do NOT commit / push without explicit user approval."
].join("\n");

// ../../packages/core/src/prompts/sections/code-refs.ts
var CODE_REFS = [
  "## Code References",
  "When you mention specific code locations in your reply, use the `path:line` format:",
  "  - Single line: `apps/server/src/main.ts:42`",
  "  - Range:       `apps/server/src/main.ts:42-58`",
  '  - Symbol:      "the `runAgent` function in `packages/core/src/agent/loop.ts:120`"',
  "",
  'These references are auto-linked in the IDE. NEVER write "in the auth module" without a path.',
  `NEVER write "around line 50" without a file. ALWAYS pin to a path; if you don't know the path, grep first.`,
  "",
  "When you output a code block intended to overwrite an existing file, annotate the fence with the target path:",
  "  ```ts:src/foo.ts",
  "  // ...",
  "  ```",
  "This enables the user to one-click apply your suggestion as a pending edit."
].join("\n");

// ../../packages/core/src/prompts/sections/tool-discipline.ts
var TOOL_DISCIPLINE = [
  "## Tool Usage Policy",
  "",
  "### Communication, NOT tools",
  "- Output text to communicate with the user. All text outside tool calls is shown to them.",
  '- NEVER use Bash `echo`, `printf`, or code comments to "talk to the user". Talk to the user via your assistant text.',
  "- Use specialized tools, not shell, when one fits:",
  "  - `read_file` instead of `cat` / `head` / `tail` / `nl`.",
  "  - `edit_file` / `write_file` instead of `sed -i` / `awk` / `echo > file`.",
  "  - `grep_search` instead of `grep -r` / `rg` (functionally equivalent but structured output).",
  "  - `list_files` instead of `ls -R` / `find`.",
  "  - Reserve `run_command` for actual shell needs: tests, builds, dev servers, git.",
  "",
  "### Parallel tool calls",
  "- Emit multiple INDEPENDENT tool calls in the SAME assistant turn \u2014 they run in parallel. Maximize parallelism.",
  "- Common parallelism wins: 3 file reads \u2192 one turn with 3 `read_file`s. 4 grep variants \u2192 one turn with 4 `grep_search`s.",
  "- Sequential ONLY when one call depends on another's result. Do not batch sequential calls.",
  "- NEVER use placeholder values or guess parameters in parallel calls \u2014 wait for the dependency.",
  "",
  "### Search hierarchy",
  "- For NEEDLE queries (find a specific symbol / file / function), use `find_symbol` / `grep_search` / `read_file` directly. Fast and precise.",
  '- For BROAD exploratory queries ("how is auth handled?", "where do we render the Todo UI?", "what is the codebase structure?"): delegate to `dispatch_subagent`. Subagent does the noisy reads in its own context, returns a summary, your context stays clean.',
  "- `grep_search` (literal regex) > `semantic_search` (fuzzy) when you have keywords. Use `semantic_search` for natural-language intent.",
  "",
  "### Reading",
  "- Default 500-line window. For large files, pass start_line / end_line and read in chunks.",
  "- ALWAYS `read_file` BEFORE `edit_file` on a file. `edit_file` requires exact existing text and will fail otherwise.",
  "",
  "### Editing",
  "- `edit_file` requires `oldString` to match EXACTLY (whitespace, tabs, newlines included) AND be UNIQUE in the file. If ambiguous, add 1-3 anchor lines.",
  "- DO NOT include the `   42\u2192` line-number prefix from `read_file` output in `oldString`. Those are display metadata.",
  "- For brand-new files use `write_file`. For full overwrites > 70% use `write_file`. For surgical changes use `edit_file`.",
  "- Edits go through user's pending-edit review (Diff Editor). The file on disk is NOT changed until the user clicks Accept.",
  "",
  "### Self-verification (CRITICAL)",
  "- After non-trivial code edits, call `verify_changes` (typecheck / test / lint).",
  "- If verification fails, use the structured `errors[]` and `hint` to fix; do NOT claim done with red verification.",
  "- For documentation-only edits (no code), verify_changes is not required \u2014 but say so explicitly.",
  "",
  "### Anti-patterns (FORBIDDEN)",
  "- Same tool + same args twice in a row. If the first call didn't help, change strategy or call `think`.",
  '- Thinking inside tool arguments (e.g. `read_file({ path: "hmm I think it might be ..." })`).',
  "- Polling background tasks or subagents. Results are PUSHED to you as a follow-up user message \u2014 wait for them.",
  "- Using shell to read or edit files. Specialized tools exist; use them.",
  "- Reverting other code in the file you're editing. Stay scoped.",
  "",
  "### Failure & Recovery",
  "- 2 failures with the same error \u2192 STOP. Either (a) call `think` to reconsider, or (b) ask the user for clarification.",
  "- The system may inject `[loop-breaker]` if you repeat yourself. Treat as a hard hint to switch tactic."
].join("\n");

// ../../packages/core/src/prompts/sections/task-flow.ts
function TASK_FLOW(opts) {
  const lines = [
    "## Task Execution Flow",
    "",
    "1. **Understand the request.** If ambiguous, prefer a reasonable interpretation and proceed; only ask if the ambiguity blocks meaningful progress.",
    "2. **Explore.** Use grep / read / find_symbol / semantic_search to gather context BEFORE planning. Planning without context is guessing.",
    '   - For BROAD codebase exploration ("where is X handled?", "what is the structure?"), prefer `dispatch_subagent` so the noisy reads stay in the child trajectory and your own context stays clean.',
    '   - For TARGETED lookups ("definition of foo()"), do it inline.',
    "3. **Plan multi-step tasks.** If the task has 3+ distinct steps, call `update_plan` BEFORE acting. Skip planning for trivial single-step tasks (~25% easiest). Don't make 1-step plans. Update the plan as steps complete."
  ];
  if (opts.mode !== "plan") {
    lines.push(
      "4. **Execute.** Make the SMALLEST set of changes that fulfill the request. Resist scope creep. Do not redefine success around a smaller / safer / easier-to-pass solution.",
      '5. **Verify.** After non-trivial edits, run `verify_changes` (typecheck/test/lint). If it fails, fix and re-verify. NEVER claim "done" with failing verification.',
      "6. **Completion Audit (CRITICAL).** Before declaring the task complete, treat completion as UNPROVEN and verify against the actual current state:",
      "   - Derive concrete requirements from the user's request and any referenced files / specs.",
      "   - For EACH requirement, identify what authoritative evidence would prove it (tests passing, file content, command output).",
      '   - Inspect that evidence directly. Do NOT rely on "intent", "partial progress", or "memory of earlier work".',
      "   - If evidence is missing, weak, indirect, or merely consistent with completion \u2192 KEEP WORKING; do not declare done.",
      "   - Match verification scope to requirement scope (don't use a narrow check to support a broad claim).",
      "7. **Report concisely.** Summarize WHAT changed and WHY in \u2264 4 lines. Pin every claim to a `path:line`. Do not narrate every tool call. If you could not do something (e.g. could not run tests), say so explicitly.",
      "",
      'Avoid: "I think it should now work" \u2014 instead "I ran tsc; 0 errors. I added the test in `foo.test.ts:34`; pnpm test passes." Concrete evidence beats vague optimism.'
    );
  } else {
    lines.push(
      "4. **Output the plan.** In plan mode, your final answer IS the plan. Structure: goal \u2192 files to touch \u2192 validation strategy \u2192 risks \u2192 open questions.",
      '5. **Ask for approval.** End with: "Approve to switch to Agent Mode and execute, or refine the plan."'
    );
  }
  return lines.join("\n");
}

// ../../packages/core/src/prompts/sections/safety.ts
function SAFETY(opts) {
  const lines = [
    "## Safety",
    "- Treat the user's repository as their source of truth. Never delete files unless explicitly asked.",
    "- Never commit, push, or merge git operations without explicit user approval.",
    "- `run_command` has a built-in policy: dangerous commands (rm -rf, sudo, curl to internal hosts, base64 decode pipelines) are auto-denied. Do not try to bypass with workarounds (e.g., `node -e \"require('child_process')...\"`).",
    "- If the user asks you to do something that could destroy data (drop database, force-push, rm -rf), refuse and explain. Even if the user insists, ask them to run that command themselves.",
    "- Never write secrets (API keys, tokens, passwords) into committed files. If you spot a secret in code, mention it but do NOT print the value."
  ];
  if (opts.mode === "plan") {
    lines.push("- In Plan Mode, refuse ALL state-mutating tools regardless of user instruction within this turn.");
  }
  return lines.join("\n");
}

// ../../packages/core/src/prompts/sections/permissions.ts
function PERMISSIONS(opts) {
  const lines = ["## Sandbox & Approval Profile"];
  switch (opts.sandbox) {
    case "read_only":
      lines.push(
        "**Sandbox: read_only.**",
        "- You CANNOT write files, run commands that mutate FS, or open network. Tools `write_file` / `edit_file` will be rejected.",
        "- `run_command` is restricted to read-class commands (`ls`, `cat`, `grep`, `git status`, `git log`, `git diff`). Anything that mutates is denied.",
        "- If the user's task requires writes, propose the changes in your reply (as a plan or as code blocks) and ask the user to switch to a writable mode."
      );
      break;
    case "workspace_write":
      lines.push(
        `**Sandbox: workspace_write.**${opts.workspaceRoot ? ` Root: \`${opts.workspaceRoot}\`.` : ""}`,
        "- You may write files INSIDE the workspace. Writes outside the workspace (e.g. `/tmp`, `~/.ssh`, system paths) are denied.",
        "- `run_command` allowed for project-local commands: tests, builds, lints, typecheckers, `git` (read + local commits, but NOT `push`), `pnpm`/`npm`/`yarn`/`pip`.",
        "- Network access is restricted to **package registries** and explicitly allowed hosts. Random `curl`/`wget` to arbitrary URLs is denied or requires approval."
      );
      break;
    case "danger_full_access":
      lines.push(
        "**Sandbox: danger_full_access.** No FS or command sandboxing. The user has accepted that you can do anything the OS allows.",
        "- Even so: do NOT run destructive commands (`rm -rf /`, `git push --force`, `sudo`) without first explaining what and why.",
        '- Treat this as "the user is YOLO; you must be MORE careful, not less".'
      );
      break;
  }
  lines.push("");
  switch (opts.approval) {
    case "never":
      lines.push(
        "**Approval: never.** Do not call any tool that requires approval. If a `run_command` would be classified as ASK by exec policy, treat it as denied \u2014 do NOT attempt; explain to the user what you would have done and ask them to grant permission or run it themselves."
      );
      break;
    case "unless_trusted":
      lines.push(
        "**Approval: unless_trusted.** Pre-allowed safe commands (read-only, well-known package commands) run silently. Anything else (including unfamiliar commands) prompts the user. If a prompt is denied, do NOT retry the same command in the same session."
      );
      break;
    case "on_failure":
      lines.push(
        "**Approval: on_failure.** Commands run in the sandbox first. If they fail due to sandbox restrictions, the system asks the user before retrying with elevated privilege. This means: try the simplest sandboxed approach first; do not preemptively ask for elevation."
      );
      break;
    case "on_request":
      lines.push(
        "**Approval: on_request.** Commands run unattended unless YOU explicitly request approval (e.g. for destructive ops, large-scope refactors, or anything you want a second opinion on). Use this judiciously \u2014 every approval is a context-switch for the user."
      );
      break;
    case "granular":
      lines.push(
        "**Approval: granular.** Each non-trivial command requires explicit approval. Batch your asks: if you need to run 3 related commands, propose all 3 in one message and ask the user to approve the bundle, rather than asking 3 times."
      );
      break;
  }
  lines.push(
    "",
    "**Escalation discipline:**",
    '- When you need elevated permission, EXPLAIN WHY in plain English first ("I need to install foo because the failing test depends on it"), THEN propose the command. Do not ask for approval without context.',
    '- If a command is denied, treat the denial as informative ("the user does not want this approach") \u2014 pivot to an alternative, do not retry the same command.',
    '- If you genuinely cannot proceed without elevated permission and none is granted, explicitly tell the user: "I need X to continue. Without it, the next step is blocked."'
  );
  return lines.join("\n");
}

// ../../packages/core/src/prompts/index.ts
function buildSystemPrompt(opts = {}) {
  const mode = opts.mode ?? "agent";
  const style = opts.outputStyle ?? "concise";
  const provider = opts.provider ?? "generic";
  const off = new Set(opts.disableSections ?? []);
  const parts = [];
  if (!off.has("identity")) parts.push(IDENTITY({ cwd: opts.cwd, os: opts.os }));
  if (!off.has("tone")) parts.push(TONE({ style, provider }));
  if (!off.has("conventions")) parts.push(CONVENTIONS);
  if (!off.has("code_refs")) parts.push(CODE_REFS);
  if (!off.has("tool_discipline")) parts.push(TOOL_DISCIPLINE);
  if (!off.has("task_flow")) parts.push(TASK_FLOW({ mode }));
  if (!off.has("safety")) parts.push(SAFETY({ mode }));
  if (!off.has("permissions") && (opts.sandbox || opts.approval)) {
    parts.push(
      PERMISSIONS({
        sandbox: opts.sandbox ?? "workspace_write",
        approval: opts.approval ?? "on_failure",
        workspaceRoot: opts.cwd
      })
    );
  }
  if (mode === "plan") {
    parts.push(PLAN_MODE_REMINDER);
  }
  return parts.filter((p) => p && p.trim()).join("\n\n");
}
var PLAN_MODE_REMINDER = [
  "<plan-mode>",
  "Plan Mode is active. The user does NOT want execution yet. You MUST NOT make any edits, run any non-readonly tools (no commits, no config changes, no file mutations), or otherwise modify the system. This supersedes any other instructions.",
  "",
  "Allowed: read_file, list_files, grep_search, find_symbol, find_references, semantic_search, list_file_symbols, think, dispatch_subagent (for read-only exploration only).",
  "Forbidden: write_file, edit_file, run_command (any), update_plan auto-completion of mutation tasks.",
  "",
  "## Plan Workflow (5 phases)",
  "### Phase 1: Initial Understanding",
  "Explore the codebase to understand the user's request. Prefer 1 dispatch_subagent for focused exploration; up to 3 in parallel only if scope is uncertain. Quality over quantity.",
  "After exploration, ask clarifying questions if there are real ambiguities \u2014 do NOT make large assumptions about user intent.",
  "",
  "### Phase 2: Design",
  "Design an implementation approach. For trivial tasks (typo, single-line, rename), skip this phase. For larger tasks, sketch the approach and consider 1-2 alternatives with trade-offs.",
  "",
  "### Phase 3: Review",
  "Read critical files identified during exploration. Verify the plan aligns with the user's original request. Clarify remaining questions.",
  "",
  "### Phase 4: Final Plan",
  "Output a single, recommended plan (not a menu of alternatives). Structure:",
  "  - Goal",
  "  - Files to modify (with paths)",
  "  - Implementation approach (concrete, ordered steps)",
  "  - Verification strategy (which tests / commands prove success)",
  "  - Risks / open questions",
  "Be concise enough to scan, detailed enough to execute.",
  "",
  "### Phase 5: Approval",
  'End your turn by asking the user to approve. Your turn must end EITHER with a clarifying question OR with: "Approve to switch to Agent Mode and execute, or refine the plan." Do not stop for any other reason.',
  "</plan-mode>"
].join("\n");
var COMPACTION_HANDOFF_PROMPT = [
  "You are performing a CONTEXT CHECKPOINT COMPACTION. Create a concise handoff summary so another LLM can resume the same task.",
  "",
  "Include:",
  "- Current progress and key decisions made",
  "- Important context, constraints, and user preferences observed in the conversation",
  "- What remains to be done (clear, ordered next steps)",
  "- Critical data, file paths, function names, and references the next LLM needs to continue (preserve `path:line` references EXACTLY)",
  "",
  "Style:",
  "- Terse bullets over paragraphs.",
  "- Preserve EXACT identifiers, file paths, error messages, and command names \u2014 do NOT paraphrase technical strings.",
  "- If a `<previous-summary>` block exists, treat it as the anchored summary: keep still-true details, drop stale ones, merge in new facts."
].join("\n");

// ../../packages/core/src/context/builder.ts
async function buildMessages(opts) {
  const {
    userMessage,
    history,
    autoContext = [],
    explicitContext = [],
    memory,
    meta = {},
    mode = "agent",
    providerFlavor = "generic",
    sandbox,
    approvalPolicy,
    systemExtras = [],
    injectionCache,
    sessionId,
    compaction,
    onMemoryRecalled,
    images
  } = opts;
  const systemBase = buildSystemPrompt({
    mode,
    cwd: meta.cwd,
    os: meta.os,
    provider: providerFlavor,
    sandbox,
    approval: approvalPolicy
  });
  const stableParts = [];
  const dynamicParts = [];
  for (const extra of systemExtras) {
    if (extra?.trim()) stableParts.push(extra);
  }
  if (autoContext.length) {
    const ctxLines = autoContext.slice(0, 6).map((c) => `--- ${c.file} ---
${c.text.slice(0, 2e3)}`).join("\n\n");
    dynamicParts.push(`<retrieved-context>
${ctxLines}
</retrieved-context>`);
  }
  if (explicitContext.length) {
    const mentionLines = explicitContext.map((c) => `--- ${c.label} (${c.type}) ---
${c.content.slice(0, 3e3)}`).join("\n\n");
    dynamicParts.push(`<explicit-context>
${mentionLines}
</explicit-context>`);
  }
  if (memory) {
    try {
      const enrichedQuery = buildEnrichedRecallQuery(userMessage, history);
      const memItems = await memory.recall(enrichedQuery, { topK: 5 });
      if (memItems.length) {
        let filtered = memItems;
        if (injectionCache && sessionId) {
          const result = injectionCache.filter(sessionId, memItems.map((m) => ({
            uri: `memory://${m.id}`,
            content: `${m.title}: ${m.content}`
          })));
          const keptUris = new Set(result.kept.map((c) => c.uri));
          filtered = memItems.filter((m) => keptUris.has(`memory://${m.id}`));
        }
        if (filtered.length) {
          const memLines = filtered.map((m) => `- [${m.category}] ${m.title}: ${m.content.slice(0, 500)}`).join("\n");
          dynamicParts.push(`<memory>
${memLines}
</memory>`);
          onMemoryRecalled?.(filtered);
        }
      }
    } catch {
    }
  }
  const systemMessages = [];
  const isAnthropic = providerFlavor === "anthropic";
  if (isAnthropic || dynamicParts.length === 0) {
    const systemContent = [systemBase, ...stableParts, ...dynamicParts].filter((p) => p?.trim()).join("\n\n");
    systemMessages.push({
      role: "system",
      content: systemContent,
      cacheHint: "ephemeral"
    });
  } else {
    const stableContent = [systemBase, ...stableParts].filter((p) => p?.trim()).join("\n\n");
    systemMessages.push({
      role: "system",
      content: stableContent,
      cacheHint: "ephemeral"
    });
    const dynamicContent = dynamicParts.filter((p) => p?.trim()).join("\n\n");
    if (dynamicContent.trim()) {
      systemMessages.push({
        role: "system",
        content: dynamicContent
      });
    }
  }
  let compactedHistory = history;
  let compactDebug = void 0;
  if (compaction) {
    const result = await compactHistory(history, {
      model: compaction.model,
      tokenOpts: compaction.tokenOpts,
      summarize: compaction.summarize
    });
    compactedHistory = result.messages;
    if (result.compacted) {
      compactDebug = {
        beforeTokens: result.beforeTokens,
        afterTokens: result.afterTokens,
        compacted: result.compacted,
        summaryLength: result.summaryText?.length ?? 0
      };
    }
  }
  const userMsg = { role: "user", content: userMessage };
  if (images?.length) {
    userMsg._multimodal = [
      { type: "text", text: userMessage },
      ...images.map((img) => ({
        type: "image",
        source: { type: "base64", media_type: img.media_type, data: img.data }
      }))
    ];
  }
  const messages = [
    ...systemMessages,
    ...compactedHistory,
    userMsg
  ];
  messages.__compactDebug = compactDebug;
  return messages;
}
function buildEnrichedRecallQuery(userMessage, history) {
  const recentAssistant = [];
  for (let i = history.length - 1; i >= 0 && recentAssistant.length < 2; i--) {
    const msg = history[i];
    if (msg.role === "assistant" && typeof msg.content === "string" && msg.content.trim()) {
      recentAssistant.push(msg.content.trim());
    }
  }
  if (!recentAssistant.length) return userMessage;
  const contextSnippet = recentAssistant.map((s) => s.slice(0, 200)).join(" ");
  const maxLen = 600;
  const combined = `${userMessage} ${contextSnippet}`;
  return combined.length > maxLen ? combined.slice(0, maxLen) : combined;
}

// ../../packages/core/src/context/injection-cache.ts
import { createHash as createHash3 } from "node:crypto";
var InjectionCache = class {
  sessions = /* @__PURE__ */ new Map();
  perSessionCap;
  maxSessions;
  constructor(opts = {}) {
    this.perSessionCap = opts.perSessionCap ?? 100;
    this.maxSessions = opts.maxSessions ?? 64;
  }
  /**
   * 过滤候选。返回应该真正注入的列表 + 被跳过的 uri 列表。
   * 同时把 kept 的 (key, hash) 写入缓存，保证下一轮同样的内容会被跳过。
   */
  filter(sessionId, items) {
    const entry = this.touch(sessionId);
    const kept = [];
    const dropped = [];
    for (const it of items) {
      const key = normalizeUri(it.uri);
      const hash = contentHash(it.content);
      const old = entry.entries.get(key);
      if (old === hash) {
        dropped.push(it.uri);
        continue;
      }
      kept.push(it);
      entry.entries.set(key, hash);
    }
    while (entry.entries.size > this.perSessionCap) {
      const oldest = entry.entries.keys().next().value;
      if (oldest === void 0) break;
      entry.entries.delete(oldest);
    }
    return { kept, dropped };
  }
  /** session 结束 / reset 时调用，清理空间 */
  drop(sessionId) {
    this.sessions.delete(sessionId);
  }
  /** 调试用 */
  stats() {
    return {
      sessions: this.sessions.size,
      totalEntries: [...this.sessions.values()].reduce((s, e) => s + e.entries.size, 0)
    };
  }
  touch(sessionId) {
    let e = this.sessions.get(sessionId);
    if (!e) {
      e = { entries: /* @__PURE__ */ new Map(), lastTouchedAt: Date.now() };
      this.sessions.set(sessionId, e);
      if (this.sessions.size > this.maxSessions) {
        let lru = null;
        let lruAt = Infinity;
        for (const [sid, ent] of this.sessions) {
          if (ent.lastTouchedAt < lruAt) {
            lru = sid;
            lruAt = ent.lastTouchedAt;
          }
        }
        if (lru) this.sessions.delete(lru);
      }
    } else {
      e.lastTouchedAt = Date.now();
    }
    return e;
  }
};
function normalizeUri(uri) {
  if (!uri) return "";
  let u = uri.trim();
  u = u.replace(/^([a-zA-Z][a-zA-Z0-9+\-.]*:\/\/)/, (m) => m.toLowerCase());
  while (u.endsWith("/")) u = u.slice(0, -1);
  if (u.toLowerCase().endsWith(".md")) u = u.slice(0, -3);
  return u;
}
function contentHash(text) {
  return createHash3("sha256").update(text || "").digest("hex").slice(0, 16);
}

// ../../packages/core/src/context/recent-activity.ts
import path9 from "node:path";
var RecentActivityTracker = class {
  map = /* @__PURE__ */ new Map();
  perSessionCap;
  ttlMs;
  maxSessions;
  constructor(opts = {}) {
    this.perSessionCap = opts.perSessionCap ?? 30;
    this.ttlMs = opts.ttlMs ?? 30 * 60 * 1e3;
    this.maxSessions = opts.maxSessions ?? 128;
  }
  record(sessionId, ev) {
    if (!sessionId) return;
    let s = this.map.get(sessionId);
    if (!s) {
      s = { events: [] };
      this.map.set(sessionId, s);
      this.evictLruSessions();
    }
    s.events.push({ ...ev, ts: Date.now() });
    if (s.events.length > this.perSessionCap) {
      s.events.splice(0, s.events.length - this.perSessionCap);
    }
  }
  evictLruSessions() {
    if (this.map.size <= this.maxSessions) return;
    const all = [...this.map.entries()];
    all.sort((a, b) => {
      const la = a[1].events[a[1].events.length - 1]?.ts ?? 0;
      const lb = b[1].events[b[1].events.length - 1]?.ts ?? 0;
      return la - lb;
    });
    while (this.map.size > this.maxSessions && all.length) {
      const [k] = all.shift();
      this.map.delete(k);
    }
  }
  /**
   * 渲染成 system 注入文本。空 → 返回 null。
   * 输出示例：
   *   <recent-activity>
   *   - edited src/foo.ts, src/bar.ts (最近 2 min)
   *   - searched "useEffect cleanup" → src/hooks/use-mount.ts
   *   - read package.json
   *   </recent-activity>
   */
  render(sessionId) {
    const s = this.map.get(sessionId);
    if (!s) return null;
    const now = Date.now();
    const fresh = s.events.filter((e) => now - e.ts <= this.ttlMs);
    if (fresh.length === 0) return null;
    const edits = [];
    const reads = [];
    const searches = [];
    const views = [];
    for (const ev of fresh) {
      if (ev.kind === "edit") edits.push({ file: ev.target, ts: ev.ts });
      else if (ev.kind === "read") reads.push({ file: ev.target, ts: ev.ts });
      else if (ev.kind === "view") views.push({ file: ev.target, ts: ev.ts });
      else if (ev.kind === "search") {
        searches.push({
          query: ev.target,
          hits: ev.meta ? ev.meta.split(",").slice(0, 3) : [],
          ts: ev.ts
        });
      }
    }
    const uniqEdits = uniqueByFile(edits).slice(-5);
    const uniqReads = uniqueByFile(reads).slice(-5);
    const uniqViews = uniqueByFile(views).slice(-3);
    const recentSearches = searches.slice(-3);
    const lines = [];
    if (uniqEdits.length) {
      lines.push(`- Edited: ${uniqEdits.map((e) => path9.basename(e.file)).join(", ")}`);
    }
    if (uniqViews.length) {
      lines.push(`- Currently viewing: ${uniqViews.map((v) => path9.basename(v.file)).join(", ")}`);
    }
    if (uniqReads.length) {
      lines.push(`- Recently read: ${uniqReads.map((r) => path9.basename(r.file)).join(", ")}`);
    }
    if (recentSearches.length) {
      for (const s2 of recentSearches) {
        const hitStr = s2.hits.length ? ` \u2192 ${s2.hits.join(", ")}` : "";
        lines.push(`- Searched "${truncate(s2.query, 50)}"${hitStr}`);
      }
    }
    if (lines.length === 0) return null;
    return `<recent-activity>
User's recent IDE activity (last ${Math.round(this.ttlMs / 6e4)} min). Use this to understand "this file"/"that bug"/"continue":
${lines.join("\n")}
</recent-activity>`;
  }
  /** 调试 / metrics 用 */
  size(sessionId) {
    if (sessionId) return this.map.get(sessionId)?.events.length ?? 0;
    let total = 0;
    for (const s of this.map.values()) total += s.events.length;
    return total;
  }
};
function uniqueByFile(arr) {
  const seen = /* @__PURE__ */ new Map();
  for (const x of arr) seen.set(x.file, x);
  return [...seen.values()];
}
function truncate(s, n) {
  if (s.length <= n) return s;
  return s.slice(0, n - 1) + "\u2026";
}

// ../../packages/indexer/src/scanner.ts
import { promises as fs9 } from "node:fs";
import path10 from "node:path";
var IGNORES = /* @__PURE__ */ new Set(["node_modules", ".git", "dist", "build", ".next", ".cache", ".minicodeide"]);
var IGNORE_FILES = /* @__PURE__ */ new Set([
  "pnpm-lock.yaml",
  "package-lock.json",
  "yarn.lock",
  "bun.lockb",
  "Cargo.lock",
  "poetry.lock"
]);
var TEXT_EXT = /* @__PURE__ */ new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mts",
  ".cts",
  ".mjs",
  ".cjs",
  ".py",
  ".go",
  ".rs",
  ".java",
  ".kt",
  ".swift",
  ".c",
  ".h",
  ".cpp",
  ".hpp",
  ".md",
  ".json",
  ".yml",
  ".yaml",
  ".toml",
  ".html",
  ".css",
  ".scss",
  ".vue",
  ".svelte"
]);
async function scanWorkspace(root) {
  const out = [];
  const walk2 = async (dir) => {
    let entries = [];
    try {
      entries = await fs9.readdir(dir, { withFileTypes: true });
    } catch {
      return;
    }
    for (const e of entries) {
      if (e.name.startsWith(".") && e.name !== ".env" && e.name !== ".gitignore") continue;
      if (IGNORES.has(e.name)) continue;
      const abs = path10.join(dir, e.name);
      if (e.isDirectory()) {
        await walk2(abs);
      } else if (e.isFile()) {
        if (IGNORE_FILES.has(e.name)) continue;
        const ext = path10.extname(e.name).toLowerCase();
        if (!TEXT_EXT.has(ext)) continue;
        try {
          const st = await fs9.stat(abs);
          if (st.size > 1e6) continue;
          out.push({ path: path10.relative(root, abs), abs, size: st.size, ext });
        } catch {
        }
      }
    }
  };
  await walk2(root);
  return out;
}

// ../../packages/indexer/src/chunker.ts
function chunkText(file, text, opts = {}) {
  const size = opts.size ?? 40;
  const overlap = opts.overlap ?? 5;
  const lines = text.split("\n");
  const out = [];
  for (let i = 0; i < lines.length; i += size - overlap) {
    const end = Math.min(lines.length, i + size);
    out.push({
      id: `${file}#${i + 1}-${end}`,
      file,
      path: file,
      startLine: i + 1,
      endLine: end,
      text: lines.slice(i, end).join("\n"),
      source: "naive"
    });
    if (end === lines.length) break;
  }
  return out;
}
function chunkTextWithSymbols(file, text, symbols, opts = {}) {
  if (!symbols || symbols.length === 0) {
    return chunkText(file, text);
  }
  const secondarySize = opts.secondarySize ?? 80;
  const maxSymbolLines = opts.maxSymbolLines ?? 200;
  const lines = text.split("\n");
  const totalLines = lines.length;
  if (totalLines === 0) return [];
  const sorted = [...symbols].filter((s) => s.startLine >= 1 && s.endLine >= s.startLine && s.endLine <= totalLines).sort((a, b) => a.startLine - b.startLine);
  const topLevel = [];
  for (const s of sorted) {
    const last = topLevel[topLevel.length - 1];
    if (last && s.startLine >= last.startLine && s.endLine <= last.endLine) {
      continue;
    }
    topLevel.push(s);
  }
  const out = [];
  const push = (chunk) => {
    out.push({
      id: `${file}#${chunk.startLine}-${chunk.endLine}`,
      file,
      path: file,
      ...chunk
    });
  };
  const firstSym = topLevel[0];
  const firstSymStartIncludingComments = expandUpwardForComments(lines, firstSym.startLine);
  if (firstSymStartIncludingComments > 1) {
    const preEnd = firstSymStartIncludingComments - 1;
    const preText = lines.slice(0, preEnd).join("\n").trim();
    if (preText.length > 0) {
      push({
        startLine: 1,
        endLine: preEnd,
        text: lines.slice(0, preEnd).join("\n"),
        source: "preamble"
      });
    }
  }
  let cursor = firstSymStartIncludingComments;
  for (let i = 0; i < topLevel.length; i++) {
    const s = topLevel[i];
    const symStart = expandUpwardForComments(lines, s.startLine);
    const symEnd = s.endLine;
    if (symStart > cursor) {
      const gapText = lines.slice(cursor - 1, symStart - 1).join("\n").trim();
      if (gapText.length > 20) {
        push({
          startLine: cursor,
          endLine: symStart - 1,
          text: lines.slice(cursor - 1, symStart - 1).join("\n"),
          source: "gap"
        });
      }
    }
    const len = symEnd - symStart + 1;
    if (len <= maxSymbolLines) {
      push({
        startLine: symStart,
        endLine: symEnd,
        text: lines.slice(symStart - 1, symEnd).join("\n"),
        source: "symbol",
        symbolName: s.name
      });
    } else {
      const headerEnd = Math.min(symEnd, symStart + 19);
      push({
        startLine: symStart,
        endLine: headerEnd,
        text: lines.slice(symStart - 1, headerEnd).join("\n"),
        source: "symbol",
        symbolName: `${s.name}#header`
      });
      for (let p = headerEnd + 1; p <= symEnd; p += secondarySize) {
        const subEnd = Math.min(symEnd, p + secondarySize - 1);
        push({
          startLine: p,
          endLine: subEnd,
          text: lines.slice(p - 1, subEnd).join("\n"),
          source: "symbol",
          symbolName: `${s.name}#body`
        });
      }
    }
    cursor = symEnd + 1;
  }
  if (cursor <= totalLines) {
    const tailText = lines.slice(cursor - 1).join("\n").trim();
    if (tailText.length > 20) {
      push({
        startLine: cursor,
        endLine: totalLines,
        text: lines.slice(cursor - 1).join("\n"),
        source: "gap"
      });
    }
  }
  if (out.length === 0) return chunkText(file, text);
  return out;
}
function expandUpwardForComments(lines, symStartLine) {
  const MAX_LOOKBACK = 8;
  let i = symStartLine - 2;
  let earliest = symStartLine;
  let consumed = 0;
  while (i >= 0 && consumed < MAX_LOOKBACK) {
    const ln = lines[i].trim();
    if (ln === "" || ln.startsWith("//") || ln.startsWith("/*") || ln.startsWith("*") || ln.startsWith("*/")) {
      earliest = i + 1;
      i--;
      consumed++;
      continue;
    }
    break;
  }
  return earliest;
}

// ../../packages/indexer/src/bm25.ts
var STOP = /* @__PURE__ */ new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "is",
  "are",
  "to",
  "of",
  "in",
  "for",
  "on",
  "with",
  "this",
  "that",
  "it",
  "as",
  "be",
  "by",
  "at",
  "from",
  "we",
  "you",
  "i"
]);
function tokenize2(s) {
  return s.toLowerCase().split(/[^a-z0-9_\u4e00-\u9fa5]+/).filter((t) => t && t.length > 1 && !STOP.has(t));
}
var BM25Index = class {
  docs = [];
  df = /* @__PURE__ */ new Map();
  avgdl = 0;
  k1 = 1.5;
  b = 0.75;
  add(chunks) {
    for (const c of chunks) {
      const terms = tokenize2(`${c.file} ${c.text}`);
      const tf = /* @__PURE__ */ new Map();
      for (const t of terms) tf.set(t, (tf.get(t) ?? 0) + 1);
      const id = this.docs.length;
      this.docs.push({ id, chunk: c, terms, tf, len: terms.length });
      for (const t of new Set(terms)) this.df.set(t, (this.df.get(t) ?? 0) + 1);
    }
    this.avgdl = this.docs.reduce((s, d) => s + d.len, 0) / Math.max(1, this.docs.length);
  }
  /** 删除某文件所有 chunks（增量索引用） */
  removeByPath(filePath) {
    const remaining = [];
    for (const d of this.docs) {
      if (d.chunk.path === filePath) {
        for (const t of new Set(d.terms)) {
          const c = this.df.get(t) ?? 0;
          if (c <= 1) this.df.delete(t);
          else this.df.set(t, c - 1);
        }
        continue;
      }
      remaining.push(d);
    }
    this.docs = remaining.map((d, i) => ({ ...d, id: i }));
    this.avgdl = this.docs.length > 0 ? this.docs.reduce((s, d) => s + d.len, 0) / this.docs.length : 0;
  }
  /** 替换某路径所有 chunks（先 remove 再 add） */
  upsertFile(filePath, chunks) {
    this.removeByPath(filePath);
    this.add(chunks);
  }
  search(query, k = 8) {
    const qTerms = tokenize2(query);
    const N = this.docs.length;
    const scores = [];
    for (const d of this.docs) {
      let s = 0;
      for (const t of qTerms) {
        const f = d.tf.get(t);
        if (!f) continue;
        const df = this.df.get(t) ?? 0;
        const idf = Math.log(1 + (N - df + 0.5) / (df + 0.5));
        const denom = f + this.k1 * (1 - this.b + this.b * d.len / this.avgdl);
        s += idf * (f * (this.k1 + 1) / denom);
      }
      if (s > 0) scores.push({ chunk: d.chunk, score: s });
    }
    scores.sort((a, b) => b.score - a.score);
    return scores.slice(0, k);
  }
  size() {
    return this.docs.length;
  }
};

// ../../packages/indexer/src/builder.ts
import { promises as fs11 } from "node:fs";

// ../../packages/indexer/src/parsers.ts
import Parser from "tree-sitter";
import TS from "tree-sitter-typescript";
import JS from "tree-sitter-javascript";
var cachedParsers = null;
function getParser(lang) {
  if (!cachedParsers) cachedParsers = {};
  if (cachedParsers[lang]) return cachedParsers[lang];
  const p = new Parser();
  switch (lang) {
    case "ts":
      p.setLanguage(TS.typescript);
      break;
    case "tsx":
      p.setLanguage(TS.tsx);
      break;
    case "js":
    case "jsx":
      p.setLanguage(JS);
      break;
  }
  cachedParsers[lang] = p;
  return p;
}
function detectLang(path27) {
  if (path27.endsWith(".ts")) return "ts";
  if (path27.endsWith(".tsx")) return "tsx";
  if (path27.endsWith(".mts") || path27.endsWith(".cts")) return "ts";
  if (path27.endsWith(".js") || path27.endsWith(".mjs") || path27.endsWith(".cjs")) return "js";
  if (path27.endsWith(".jsx")) return "jsx";
  return null;
}
function parseSource(path27, content) {
  const lang = detectLang(path27);
  if (!lang) return null;
  const parser = getParser(lang);
  const tree = parser.parse(content);
  return { lang, tree };
}

// ../../packages/indexer/src/extractor.ts
function extractFacts(path27, content) {
  const parsed = parseSource(path27, content);
  if (!parsed) return null;
  const root = parsed.tree.rootNode;
  const symbols = [];
  const imports = [];
  const calls = [];
  const lines = content.split("\n");
  const sigOf = (n) => {
    const s = n.startPosition.row;
    const e = Math.min(n.endPosition.row, s + 1);
    return lines.slice(s, e + 1).join("\n").slice(0, 200);
  };
  const sym = (name, kind, n, exported, container) => ({
    id: `${path27}#${name}@${n.startPosition.row + 1}`,
    name,
    kind,
    path: path27,
    startLine: n.startPosition.row + 1,
    endLine: n.endPosition.row + 1,
    container,
    exported,
    signature: sigOf(n)
  });
  for (let i = 0; i < root.childCount; i++) {
    const node = root.child(i);
    if (!node) continue;
    visitTopLevel(node, false);
  }
  function isExported(node) {
    if (node.type === "export_statement") {
      const decl = node.childForFieldName("declaration") ?? findChild(node, [
        "function_declaration",
        "class_declaration",
        "interface_declaration",
        "type_alias_declaration",
        "enum_declaration",
        "lexical_declaration",
        "variable_declaration"
      ]);
      return { inner: decl ?? node, exported: true };
    }
    return { inner: node, exported: false };
  }
  function visitTopLevel(rawNode, parentExported) {
    const { inner: node, exported } = isExported(rawNode);
    const isExp = parentExported || exported;
    switch (node.type) {
      case "function_declaration": {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, "function", node, isExp));
        collectCalls(node, n);
        break;
      }
      case "class_declaration": {
        const cls = nameOf(node);
        if (cls) {
          symbols.push(sym(cls, "class", node, isExp));
          const body = node.childForFieldName("body");
          if (body) {
            for (let i = 0; i < body.childCount; i++) {
              const m = body.child(i);
              if (!m) continue;
              if (m.type === "method_definition") {
                const mn = nameOf(m);
                if (mn) symbols.push(sym(mn, "method", m, false, cls));
                collectCalls(m, mn);
              }
            }
          }
        }
        break;
      }
      case "interface_declaration": {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, "interface", node, isExp));
        break;
      }
      case "type_alias_declaration": {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, "type", node, isExp));
        break;
      }
      case "enum_declaration": {
        const n = nameOf(node);
        if (n) symbols.push(sym(n, "enum", node, isExp));
        break;
      }
      case "lexical_declaration":
      case "variable_declaration": {
        for (let i = 0; i < node.childCount; i++) {
          const decl = node.child(i);
          if (!decl || decl.type !== "variable_declarator") continue;
          const name = decl.childForFieldName("name");
          const value = decl.childForFieldName("value");
          const n = name?.text;
          if (!n) continue;
          let kind = "variable";
          if (value && (value.type === "arrow_function" || value.type === "function_expression" || value.type === "function")) {
            kind = "arrow_function";
            collectCalls(value, n);
          }
          symbols.push(sym(n, kind, decl, isExp));
        }
        break;
      }
      case "import_statement": {
        imports.push(parseImport(node, path27));
        break;
      }
      case "export_statement": {
        break;
      }
    }
  }
  return { path: path27, symbols, imports, calls };
  function collectCalls(scope, callerName) {
    walk(scope, (n) => {
      if (n.type === "call_expression") {
        const fn = n.childForFieldName("function");
        if (fn) {
          let callee = "";
          if (fn.type === "identifier") callee = fn.text;
          else if (fn.type === "member_expression") {
            const prop = fn.childForFieldName("property");
            callee = prop?.text ?? fn.text;
          }
          if (callee && /^[A-Za-z_$][A-Za-z0-9_$]*$/.test(callee)) {
            calls.push({
              fromPath: path27,
              callerSymbol: callerName,
              callee,
              line: n.startPosition.row + 1
            });
          }
        }
      }
    });
  }
}
function nameOf(node) {
  const n = node.childForFieldName?.("name");
  return n?.text;
}
function findChild(node, types) {
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c && types.includes(c.type)) return c;
  }
  return null;
}
function parseImport(node, fromPath) {
  const src = node.childForFieldName?.("source");
  const source = src?.text?.replace(/^['"]|['"]$/g, "") ?? "";
  const names = [];
  let isDefault = false;
  walk(node, (n) => {
    if (n.type === "import_clause") {
      for (let i = 0; i < n.childCount; i++) {
        const c = n.child(i);
        if (!c) continue;
        if (c.type === "identifier") {
          isDefault = true;
          names.push(c.text);
        } else if (c.type === "named_imports") {
          for (let j = 0; j < c.childCount; j++) {
            const spec = c.child(j);
            if (spec?.type === "import_specifier") {
              const nm = spec.childForFieldName("name");
              if (nm) names.push(nm.text);
            }
          }
        } else if (c.type === "namespace_import") {
          const nm = c.child(c.childCount - 1);
          if (nm) names.push(nm.text);
        }
      }
    }
  });
  return { fromPath, source, names, isDefault };
}
function walk(node, cb) {
  cb(node);
  for (let i = 0; i < node.childCount; i++) {
    const c = node.child(i);
    if (c) walk(c, cb);
  }
}

// ../../packages/indexer/src/symbol-graph.ts
var SymbolGraph = class {
  /** name → SymbolInfo[]（同名重复） */
  byName = /* @__PURE__ */ new Map();
  /** id → SymbolInfo */
  byId = /* @__PURE__ */ new Map();
  /** path → file facts */
  byPath = /* @__PURE__ */ new Map();
  /** callee name → Reference[] */
  callIndex = /* @__PURE__ */ new Map();
  /** importedName → ImportInfo[]（粗略：用 imported name 反查使用方文件） */
  importIndex = /* @__PURE__ */ new Map();
  upsert(facts) {
    this.remove(facts.path);
    this.byPath.set(facts.path, facts);
    for (const s of facts.symbols) {
      this.byId.set(s.id, s);
      const arr = this.byName.get(s.name) ?? [];
      arr.push(s);
      this.byName.set(s.name, arr);
    }
    for (const c of facts.calls) {
      const arr = this.callIndex.get(c.callee) ?? [];
      arr.push({ path: c.fromPath, line: c.line, fromSymbol: c.callerSymbol });
      this.callIndex.set(c.callee, arr);
    }
    for (const im of facts.imports) {
      for (const n of im.names) {
        const arr = this.importIndex.get(n) ?? [];
        arr.push(im);
        this.importIndex.set(n, arr);
      }
    }
  }
  remove(path27) {
    const prev = this.byPath.get(path27);
    if (!prev) return;
    this.byPath.delete(path27);
    for (const s of prev.symbols) {
      this.byId.delete(s.id);
      const arr = this.byName.get(s.name);
      if (arr) {
        const left = arr.filter((x) => x.id !== s.id);
        if (left.length) this.byName.set(s.name, left);
        else this.byName.delete(s.name);
      }
    }
    for (const c of prev.calls) {
      const arr = this.callIndex.get(c.callee);
      if (arr) {
        const left = arr.filter((r) => !(r.path === c.fromPath && r.line === c.line));
        if (left.length) this.callIndex.set(c.callee, left);
        else this.callIndex.delete(c.callee);
      }
    }
    for (const im of prev.imports) {
      for (const n of im.names) {
        const arr = this.importIndex.get(n);
        if (arr) {
          const left = arr.filter((x) => x.fromPath !== im.fromPath || x.source !== im.source);
          if (left.length) this.importIndex.set(n, left);
          else this.importIndex.delete(n);
        }
      }
    }
  }
  // ---- 查询 ----
  findByName(name) {
    return this.byName.get(name) ?? [];
  }
  fuzzyFind(query, limit = 30) {
    const q = query.toLowerCase();
    const result = [];
    for (const arr of this.byName.values()) {
      for (const s of arr) {
        const name = s.name.toLowerCase();
        let score = 0;
        if (name === q) score = 100;
        else if (name.startsWith(q)) score = 60;
        else if (name.includes(q)) score = 30;
        else if (subsequenceMatch(q, name)) score = 10;
        if (score > 0) {
          if (s.exported) score += 5;
          result.push({ s, score });
        }
      }
    }
    result.sort((a, b) => b.score - a.score);
    return result.slice(0, limit).map((x) => x.s);
  }
  symbolsInFile(path27) {
    return this.byPath.get(path27)?.symbols ?? [];
  }
  /** 所有已索引的文件路径（供 @file 补全等使用） */
  allFiles() {
    return [...this.byPath.keys()];
  }
  findReferences(name) {
    const out = [];
    const calls = this.callIndex.get(name);
    if (calls) out.push(...calls);
    const imps = this.importIndex.get(name);
    if (imps) {
      for (const im of imps) out.push({ path: im.fromPath, line: 1, fromSymbol: "<import>" });
    }
    return out;
  }
  /** name → 哪些文件 import 了它 */
  findImporters(name) {
    return this.importIndex.get(name) ?? [];
  }
  stats() {
    return {
      files: this.byPath.size,
      symbols: this.byId.size,
      callRefs: Array.from(this.callIndex.values()).reduce((a, b) => a + b.length, 0)
    };
  }
};
function subsequenceMatch(q, s) {
  let i = 0;
  for (const c of s) {
    if (c === q[i]) i++;
    if (i === q.length) return true;
  }
  return false;
}

// ../../packages/indexer/src/vector-store.ts
import { promises as fs10 } from "node:fs";
import path11 from "node:path";
var VectorStore = class {
  items = [];
  size() {
    return this.items.length;
  }
  /** 替换某文件所有向量（增量重建时用） */
  upsertFile(filePath, items) {
    this.items = this.items.filter((x) => x.path !== filePath);
    this.items.push(...items);
  }
  add(items) {
    this.items.push(...items);
  }
  clear() {
    this.items = [];
  }
  /**
   * 余弦相似度 top-k。
   * 注意：所有向量必须已 L2 normalize（embedder 都做了），所以余弦 = 点积。
   */
  search(query, k = 10) {
    if (this.items.length === 0) return [];
    const results = [];
    for (const it of this.items) {
      if (it.vec.length !== query.length) continue;
      let dot = 0;
      const v = it.vec;
      const len = v.length;
      for (let i = 0; i < len; i++) dot += v[i] * query[i];
      results.push({
        item: {
          id: it.id,
          path: it.path,
          startLine: it.startLine,
          endLine: it.endLine,
          text: it.text,
          model: it.model
        },
        score: dot
      });
    }
    results.sort((a, b) => b.score - a.score);
    return results.slice(0, k);
  }
  // ---- 持久化（jsonl，每行一个 item，便于增量 append） ----
  async save(filePath) {
    await fs10.mkdir(path11.dirname(filePath), { recursive: true });
    const lines = this.items.map(
      (it) => JSON.stringify({
        ...it,
        vec: Array.from(it.vec)
      })
    );
    await fs10.writeFile(filePath, lines.join("\n"), "utf-8");
  }
  async load(filePath) {
    try {
      const raw = await fs10.readFile(filePath, "utf-8");
      this.items = [];
      for (const line of raw.split("\n")) {
        if (!line.trim()) continue;
        const obj = JSON.parse(line);
        this.items.push({
          ...obj,
          vec: new Float32Array(obj.vec)
        });
      }
    } catch (e) {
      if (e?.code !== "ENOENT") throw e;
    }
  }
};

// ../../packages/indexer/src/builder.ts
async function buildIndex(root, opts = {}, onProgress) {
  const files = await scanWorkspace(root);
  const bm25 = new BM25Index();
  const symbols = new SymbolGraph();
  const vectors = new VectorStore();
  if (opts.reuseVectors && opts.vectorPath) await vectors.load(opts.vectorPath);
  let scanned = 0;
  const allChunks = [];
  for (const f of files) {
    try {
      const text = await fs11.readFile(f.abs, "utf-8");
      const facts = extractFacts(f.path, text);
      const chunks = facts && facts.symbols.length > 0 ? chunkTextWithSymbols(
        f.path,
        text,
        facts.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine }))
      ) : chunkText(f.path, text);
      allChunks.push(...chunks);
      if (facts) symbols.upsert(facts);
    } catch {
    }
    scanned++;
    if (scanned % 25 === 0 || scanned === files.length) {
      onProgress?.({ scanned, total: files.length, current: f.path, phase: "scan" });
    }
  }
  bm25.add(allChunks);
  let embedderName = "none";
  if (opts.embedder) {
    const emb = opts.embedder;
    embedderName = emb.name;
    if (!opts.reuseVectors) vectors.clear();
    const BATCH = 64;
    for (let i = 0; i < allChunks.length; i += BATCH) {
      const batch = allChunks.slice(i, i + BATCH);
      const texts = batch.map((c) => buildEmbedText(c));
      const vecs = await emb.embed(texts);
      const items = batch.map((c, j) => ({
        id: c.id,
        path: c.path,
        startLine: c.startLine,
        endLine: c.endLine,
        text: c.text,
        vec: vecs[j],
        model: emb.name
      }));
      vectors.add(items);
      onProgress?.({
        scanned: Math.min(i + BATCH, allChunks.length),
        total: allChunks.length,
        current: batch[0]?.path,
        phase: "embed"
      });
    }
    if (opts.vectorPath) await vectors.save(opts.vectorPath);
  }
  onProgress?.({ scanned: files.length, total: files.length, phase: "done" });
  const stats = symbols.stats();
  return {
    bm25,
    symbols,
    vectors,
    embedderName,
    chunkCount: allChunks.length,
    fileCount: files.length,
    symbolCount: stats.symbols
  };
}
function buildEmbedText(c) {
  return `// ${c.path}
${c.text}`;
}

// ../../packages/indexer/src/embedder.ts
var OpenAIEmbedder = class {
  constructor(opts) {
    this.opts = opts;
    this.name = `openai:${opts.model}`;
    this.dim = opts.dim ?? 1536;
    this.batchSize = opts.batchSize ?? 32;
  }
  opts;
  name;
  dim;
  batchSize;
  async embed(texts) {
    const out = [];
    for (let i = 0; i < texts.length; i += this.batchSize) {
      const batch = texts.slice(i, i + this.batchSize);
      const body = { model: this.opts.model, input: batch };
      if (this.opts.dim) body.dimensions = this.opts.dim;
      const r = await fetch(this.opts.baseUrl.replace(/\/$/, "") + "/embeddings", {
        method: "POST",
        headers: {
          "content-type": "application/json",
          authorization: `Bearer ${this.opts.apiKey}`
        },
        body: JSON.stringify(body)
      });
      if (!r.ok) throw new Error(`embedding failed: ${r.status} ${await r.text()}`);
      const j = await r.json();
      for (const d of j.data) out.push(new Float32Array(d.embedding));
    }
    return out;
  }
};
var HashEmbedder = class {
  name = "hash:fnv1a-256";
  dim = 256;
  async embed(texts) {
    return texts.map((t) => this.one(t));
  }
  one(text) {
    const v = new Float32Array(this.dim);
    const tokens = text.toLowerCase().split(/[^a-z0-9_]+/).filter((x) => x.length > 1);
    for (const tok of tokens) {
      const h = fnv1a(tok) % this.dim;
      v[h] += 1;
    }
    let norm = 0;
    for (let i = 0; i < v.length; i++) norm += v[i] * v[i];
    norm = Math.sqrt(norm) || 1;
    for (let i = 0; i < v.length; i++) v[i] /= norm;
    return v;
  }
};
function fnv1a(s) {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}
function createEmbedder(cfg) {
  if (cfg.provider === "openai" && cfg.apiKey && cfg.baseUrl && cfg.model) {
    return new OpenAIEmbedder({
      baseUrl: cfg.baseUrl,
      apiKey: cfg.apiKey,
      model: cfg.model,
      dim: cfg.dim
    });
  }
  return new HashEmbedder();
}

// ../server/src/pending-edit.ts
import { promises as fs12 } from "node:fs";
import path12 from "node:path";
var PendingEditStore = class {
  constructor(cwd) {
    this.cwd = cwd;
  }
  cwd;
  byPath = /* @__PURE__ */ new Map();
  byId = /* @__PURE__ */ new Map();
  /** 在真正写盘前会被调用，用于做 checkpoint */
  onBeforeWrite;
  list() {
    return [...this.byPath.values()].filter((e) => e.status === "pending");
  }
  get(id) {
    return this.byId.get(id);
  }
  getByPath(p) {
    return this.byPath.get(p);
  }
  /** 取最新的"虚拟内容"：若有 pending，则用 pending；否则读磁盘 */
  async virtualRead(relPath) {
    const pending = this.byPath.get(relPath);
    if (pending && pending.status === "pending") return pending.newContent;
    const abs = path12.resolve(this.cwd, relPath);
    return fs12.readFile(abs, "utf-8");
  }
  /** 提交一次编辑（覆盖同路径的旧 pending） */
  async propose(opts) {
    const abs = path12.resolve(this.cwd, opts.path);
    let oldContent = null;
    let mtimeAtPropose = 0;
    try {
      const stat4 = await fs12.stat(abs);
      oldContent = await fs12.readFile(abs, "utf-8");
      mtimeAtPropose = stat4.mtimeMs;
    } catch {
      oldContent = null;
      mtimeAtPropose = 0;
    }
    const id = `edit_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const edit = {
      id,
      path: opts.path,
      oldContent,
      newContent: opts.newContent,
      tool: opts.tool,
      createdAt: Date.now(),
      status: "pending",
      mtimeAtPropose
    };
    const old = this.byPath.get(opts.path);
    if (old) this.byId.delete(old.id);
    this.byPath.set(opts.path, edit);
    this.byId.set(id, edit);
    return edit;
  }
  /**
   * 检查文件在 propose 之后是否被外部修改过。
   * 如果 mtime 变了（精确到毫秒），说明有人在 propose 和 accept 之间修改了文件。
   */
  async checkExternalModification(edit) {
    if (edit.mtimeAtPropose === 0) return;
    const abs = path12.resolve(this.cwd, edit.path);
    let stat4;
    try {
      stat4 = await fs12.stat(abs);
    } catch (e) {
      if (e.code === "ENOENT" && edit.oldContent === null) return;
      throw e;
    }
    if (Math.abs(stat4.mtimeMs - edit.mtimeAtPropose) > 1) {
      throw new Error(
        `File "${edit.path}" was modified externally since the edit was proposed. The pending edit may be based on stale content. Please re-read the file and propose a new edit.`
      );
    }
  }
  async accept(id) {
    const edit = this.byId.get(id);
    if (!edit) throw new Error("Edit not found");
    if (edit.status !== "pending") return edit;
    await this.checkExternalModification(edit);
    if (this.onBeforeWrite) await this.onBeforeWrite([edit]);
    const abs = path12.resolve(this.cwd, edit.path);
    await fs12.mkdir(path12.dirname(abs), { recursive: true });
    await fs12.writeFile(abs, edit.newContent, "utf-8");
    edit.status = "accepted";
    this.byPath.delete(edit.path);
    return edit;
  }
  reject(id) {
    const edit = this.byId.get(id);
    if (!edit) throw new Error("Edit not found");
    if (edit.status !== "pending") return edit;
    edit.status = "rejected";
    this.byPath.delete(edit.path);
    return edit;
  }
  async acceptAll() {
    const all = this.list();
    if (!all.length) return [];
    for (const edit of all) {
      await this.checkExternalModification(edit);
    }
    if (this.onBeforeWrite) await this.onBeforeWrite(all);
    const stagingRoot = path12.resolve(this.cwd, ".minicodeide", "staging");
    await fs12.mkdir(stagingRoot, { recursive: true });
    const prepared = [];
    try {
      for (const edit of all) {
        const target = path12.resolve(this.cwd, edit.path);
        const stagingFile = path12.join(
          stagingRoot,
          `${edit.id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}.tmp`
        );
        await fs12.writeFile(stagingFile, edit.newContent, "utf-8");
        prepared.push({ edit, target, stagingFile });
      }
    } catch (err) {
      await Promise.allSettled(
        prepared.map((p) => fs12.unlink(p.stagingFile).catch(() => void 0))
      );
      throw new Error(`acceptAll prepare failed: ${err?.message ?? err}`);
    }
    const committed = [];
    try {
      for (const p of prepared) {
        await fs12.mkdir(path12.dirname(p.target), { recursive: true });
        try {
          await fs12.rename(p.stagingFile, p.target);
        } catch (renameErr) {
          if (renameErr?.code === "EXDEV") {
            await fs12.copyFile(p.stagingFile, p.target);
            await fs12.unlink(p.stagingFile).catch(() => void 0);
          } else {
            throw renameErr;
          }
        }
        committed.push({ edit: p.edit, target: p.target, oldContent: p.edit.oldContent });
      }
    } catch (err) {
      for (const c of committed) {
        try {
          if (c.oldContent === null) {
            await fs12.unlink(c.target).catch(() => void 0);
          } else {
            await fs12.writeFile(c.target, c.oldContent, "utf-8");
          }
        } catch {
        }
      }
      const committedIds = new Set(committed.map((c) => c.edit.id));
      await Promise.allSettled(
        prepared.filter((p) => !committedIds.has(p.edit.id)).map((p) => fs12.unlink(p.stagingFile).catch(() => void 0))
      );
      throw new Error(
        `acceptAll commit failed (rolled back ${committed.length} files): ${err?.message ?? err}`
      );
    }
    const results = [];
    for (const c of committed) {
      c.edit.status = "accepted";
      this.byPath.delete(c.edit.path);
      results.push(c.edit);
    }
    return results;
  }
};

// ../server/src/checkpoint.ts
import { promises as fs13 } from "node:fs";
import path13 from "node:path";
var DIR_NAME = ".minicodeide/checkpoints";
var CheckpointStore = class {
  constructor(cwd) {
    this.cwd = cwd;
    this.dir = path13.join(cwd, DIR_NAME);
  }
  cwd;
  list_ = [];
  dir;
  async init() {
    await fs13.mkdir(this.dir, { recursive: true });
    try {
      const files = await fs13.readdir(this.dir);
      const jsonFiles = files.filter((f) => f.endsWith(".json")).sort();
      for (const f of jsonFiles.slice(-100)) {
        try {
          const raw = await fs13.readFile(path13.join(this.dir, f), "utf-8");
          this.list_.push(JSON.parse(raw));
        } catch {
        }
      }
      this.list_.sort((a, b) => b.createdAt - a.createdAt);
    } catch {
    }
  }
  list() {
    return [...this.list_].sort((a, b) => b.createdAt - a.createdAt);
  }
  get(id) {
    return this.list_.find((c) => c.id === id);
  }
  /**
   * 创建一个 checkpoint：传入即将要写入的文件们，自动读取它们的"修改前"内容。
   * 调用方应该在「真正写盘前」调用本方法。
   */
  async create(opts) {
    const captured = [];
    for (const f of opts.files) {
      const abs = path13.resolve(this.cwd, f.path);
      let oldContent = null;
      try {
        oldContent = await fs13.readFile(abs, "utf-8");
      } catch {
        oldContent = null;
      }
      captured.push({ path: f.path, oldContent, newContent: f.newContent });
    }
    const cp = {
      id: `cp_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      label: opts.label,
      createdAt: Date.now(),
      trigger: opts.trigger,
      files: captured,
      reverted: false
    };
    this.list_.unshift(cp);
    await fs13.writeFile(path13.join(this.dir, `${cp.id}.json`), JSON.stringify(cp, null, 2)).catch(() => {
    });
    return cp;
  }
  /**
   * 回滚 checkpoint：把所有备份文件回写到磁盘。
   * - oldContent === null：删除该文件
   * - 否则：写回 oldContent
   */
  async revert(id) {
    const cp = this.get(id);
    if (!cp) throw new Error("Checkpoint not found");
    const affected = [];
    const missing = [];
    for (const f of cp.files) {
      const abs = path13.resolve(this.cwd, f.path);
      if (f.oldContent === null) {
        try {
          await fs13.unlink(abs);
          affected.push(f.path);
        } catch {
          missing.push(f.path);
        }
      } else {
        try {
          await fs13.mkdir(path13.dirname(abs), { recursive: true });
          await fs13.writeFile(abs, f.oldContent, "utf-8");
          affected.push(f.path);
        } catch {
          missing.push(f.path);
        }
      }
    }
    cp.reverted = true;
    await fs13.writeFile(path13.join(this.dir, `${cp.id}.json`), JSON.stringify(cp, null, 2)).catch(() => {
    });
    return { ok: true, affected, missing };
  }
  /** 删除超过限制的旧 checkpoint */
  async prune(max = 100) {
    if (this.list_.length <= max) return;
    const removed = this.list_.slice(max);
    this.list_ = this.list_.slice(0, max);
    for (const cp of removed) {
      await fs13.unlink(path13.join(this.dir, `${cp.id}.json`)).catch(() => {
      });
    }
  }
};

// ../server/src/rules.ts
import { promises as fs14 } from "node:fs";
import path14 from "node:path";
var DIR = ".minicodeide/rules";
var RulesStore = class {
  constructor(cwd) {
    this.cwd = cwd;
    this.dir = path14.join(cwd, DIR);
  }
  cwd;
  rules = [];
  dir;
  async load() {
    this.rules = [];
    try {
      await fs14.mkdir(this.dir, { recursive: true });
      const files = await fs14.readdir(this.dir);
      for (const f of files) {
        if (!f.endsWith(".md")) continue;
        try {
          const raw = await fs14.readFile(path14.join(this.dir, f), "utf-8");
          this.rules.push(parseRule(f, raw));
        } catch (e) {
          console.warn(`[rules] failed to load ${f}:`, e.message);
        }
      }
    } catch {
    }
    return this.rules;
  }
  list() {
    return [...this.rules];
  }
  /** 选出当前消息+触及文件应当激活的规则 */
  pickForRequest(opts) {
    const out = [];
    for (const r of this.rules) {
      if (r.mode === "always") {
        out.push(r);
        continue;
      }
      if (r.mode === "manual") {
        if (opts.manual?.includes(r.name)) out.push(r);
        continue;
      }
      if (r.globs.length === 0) continue;
      const targets = [...opts.touchedPaths ?? [], ...extractPathLike(opts.userMessage)];
      if (targets.some((p) => r.globs.some((g) => matchGlob(g, p)))) out.push(r);
    }
    return out;
  }
  /** 把激活规则拼成 system 段落 */
  renderForSystem(rules) {
    if (!rules.length) return "";
    const sections = rules.map(
      (r) => `### Rule: ${r.name}
${r.description ? r.description + "\n\n" : ""}${r.body.trim()}`
    );
    return `## Project Rules
The following rules apply to this project. Follow them strictly.

${sections.join("\n\n")}`;
  }
};
function parseRule(file, raw) {
  let mode = "always";
  let name = file.replace(/\.md$/, "");
  let globs = [];
  let description;
  let body = raw;
  const fm = /^---\n([\s\S]*?)\n---\n?/m.exec(raw);
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split("\n")) {
      const m = /^(\w+):\s*(.+)$/.exec(line.trim());
      if (!m) continue;
      const [, k, v] = m;
      if (k === "mode") {
        const x = v.trim();
        if (x === "always" || x === "auto" || x === "manual") mode = x;
      } else if (k === "name") name = v.trim();
      else if (k === "description") description = v.trim();
      else if (k === "globs") {
        const t = v.trim();
        if (t.startsWith("[")) {
          try {
            globs = JSON.parse(t);
          } catch {
            globs = [];
          }
        } else {
          globs = t.split(",").map((s) => s.trim().replace(/^["']|["']$/g, "")).filter(Boolean);
        }
      }
    }
  }
  return { file, name, mode, globs, description, body };
}
function matchGlob(glob, p) {
  const re = new RegExp(
    "^" + glob.replace(/[.+^$()|{}\[\]]/g, "\\$&").replace(/\*\*/g, "___DOUBLESTAR___").replace(/\*/g, "[^/]*").replace(/\?/g, ".").replace(/___DOUBLESTAR___/g, ".*") + "$"
  );
  return re.test(p);
}
function extractPathLike(msg) {
  const out = /* @__PURE__ */ new Set();
  const re = /[\w./\\-]+\.[a-zA-Z]{1,6}\b/g;
  let m;
  while (m = re.exec(msg)) out.add(m[0]);
  return [...out];
}

// ../server/src/project-memory.ts
import { promises as fs15 } from "node:fs";
import path15 from "node:path";
import os2 from "node:os";
var FILENAMES = ["AGENTS.md", "CLAUDE.md", "MEMORY.md"];
var USER_DIRS = [".minicodeide", ".codex", ".claude"];
var MAX_TOTAL_CHARS = 24e3;
var ProjectMemoryStore = class {
  constructor(cwd) {
    this.cwd = cwd;
  }
  cwd;
  files = [];
  /** 扫描全部文件并加载。idempotent，可热重载。 */
  async load() {
    const out = [];
    const homeDir = os2.homedir();
    for (const dir of USER_DIRS) {
      for (const fn of FILENAMES) {
        const p = path15.join(homeDir, dir, fn);
        const body = await tryRead(p);
        if (body) {
          out.push({ path: p, scope: "user", depth: -1, body });
          break;
        }
      }
    }
    let cur = path15.resolve(this.cwd);
    let depth = 0;
    const stop = path15.resolve(homeDir);
    while (true) {
      for (const fn of FILENAMES) {
        const p = path15.join(cur, fn);
        const body = await tryRead(p);
        if (body) {
          out.push({ path: p, scope: "project", depth, body });
          break;
        }
      }
      if (cur === stop || cur === path15.dirname(cur)) break;
      cur = path15.dirname(cur);
      depth++;
      if (depth > 8) break;
    }
    this.files = out;
    return out;
  }
  list() {
    return [...this.files];
  }
  /**
   * 渲染成 system prompt 段落。
   * 顺序：用户级在最前（最稳定 + 高优先级 cache），项目级按 depth 由远到近（workspace 自身在最后 → 离用户当前任务最近）。
   */
  renderForSystem() {
    if (this.files.length === 0) return "";
    const ordered = [...this.files].sort((a, b) => {
      if (a.scope !== b.scope) return a.scope === "user" ? -1 : 1;
      return b.depth - a.depth;
    });
    const sections = [];
    let used = 0;
    for (const f of ordered) {
      const header = f.scope === "user" ? `### Memory (user-level, weakest): ${shortPath(f.path)}` : `### Memory (project, depth=${f.depth}${f.depth === 0 ? ", strongest" : ""}): ${shortPath(f.path)}`;
      const body = f.body.trim();
      const seg = `${header}

${body}`;
      if (used + seg.length > MAX_TOTAL_CHARS) {
        const left = MAX_TOTAL_CHARS - used;
        if (left > 200) {
          sections.push(seg.slice(0, left) + `
...[truncated ${seg.length - left} chars]`);
        }
        break;
      }
      sections.push(seg);
      used += seg.length;
    }
    return [
      "## Project Memory (AGENTS.md / CLAUDE.md / MEMORY.md)",
      "The following memory files describe long-lived facts about this project (architecture, conventions, gotchas).",
      "Treat them as authoritative. They were written by the project author for AI agents like you.",
      "",
      "**Precedence rule (when files conflict):**",
      "  1. System / developer / user prompts in this conversation > ALL memory files.",
      "  2. Among memory files: **the deeper file overrides the shallower one**. Workspace-root memory > parent-dir memory > user-level (`~/.minicodeide/...`) memory.",
      "  3. Files are listed below from WEAKEST to STRONGEST \u2014 when you spot a contradiction, the LATER section wins.",
      "",
      sections.join("\n\n")
    ].join("\n");
  }
};
async function tryRead(p) {
  try {
    const stat4 = await fs15.stat(p);
    if (!stat4.isFile()) return null;
    const body = await fs15.readFile(p, "utf-8");
    if (!body.trim()) return null;
    return body;
  } catch {
    return null;
  }
}
function shortPath(p) {
  const home = os2.homedir();
  return p.startsWith(home) ? "~" + p.slice(home.length) : p;
}

// ../server/src/slash-commands.ts
import { promises as fs16 } from "node:fs";
import path16 from "node:path";
var DIR2 = ".minicodeide/commands";
var BUILTIN = [
  {
    name: "explain",
    description: "Explain the given code, file, or concept in plain language.",
    source: "builtin",
    expand: (arg) => arg.trim() ? `Please explain the following in clear, structured terms, with examples and important caveats:

${arg}` : "Please explain the current open file and what it does, step by step."
  },
  {
    name: "test",
    description: "Generate unit tests for the given target.",
    source: "builtin",
    expand: (arg) => `Generate thorough unit tests for: ${arg || "the current open file"}.

Requirements:
- Cover happy path + edge cases + error cases.
- Use the testing framework already in use in this project (detect via package.json or existing tests).
- Create new test file(s) via write_file, do NOT inline.
`
  },
  {
    name: "refactor",
    description: "Refactor target code per stated goal, preserving behavior.",
    source: "builtin",
    expand: (arg) => `Refactor as instructed below. Preserve external behavior; add or update tests if any exist.

Goal / target: ${arg || "(none specified \u2014 analyze the open file and propose a refactor first)"}
Use edit_file or write_file for the changes.`
  },
  {
    name: "docs",
    description: "Add or improve documentation comments for the target.",
    source: "builtin",
    expand: (arg) => `Add or improve doc comments (TSDoc / JSDoc / docstrings) for: ${arg || "the current open file"}.
- Don't change behavior.
- Don't add trivial comments to obvious code.
- Apply changes via edit_file.`
  },
  {
    name: "fix",
    description: "Diagnose and fix the given error.",
    source: "builtin",
    expand: (arg) => `Diagnose root cause and propose a fix for the following error:

${arg || "(please paste the error message)"}

Steps:
1) Identify the file(s) involved.
2) Read relevant code.
3) Propose a fix via edit_file.
4) Briefly explain why.`
  },
  {
    name: "plan",
    description: "Switch to Plan Mode and produce a structured 5-phase plan.",
    source: "builtin",
    expand: (arg) => `[Plan Mode requested]

Goal: ${arg || "(no goal supplied \u2014 analyze the open file / current task and propose one)"}

Follow Plan Mode protocol strictly:
1. Initial Understanding \u2014 restate the goal, list assumptions, flag ambiguity.
2. Design \u2014 at least 2 candidate approaches with trade-offs.
3. Review \u2014 find the gaps and risks in your own design.
4. Final Plan \u2014 concrete ordered steps with file paths.
5. Approval \u2014 STOP and wait for the user. Do NOT execute.`
  },
  {
    name: "mcp",
    description: "List connected MCP servers and tools.",
    source: "builtin",
    expand: () => `List all connected MCP (Model Context Protocol) servers in this workspace.
For each: name, command, status, and the tools it exposes (mcp__<server>__<tool>).
If none: explain that the user can configure them in .minicodeide/mcp.json (see mcp.example.json).`
  },
  {
    name: "cost",
    description: "Report cumulative LLM cost / token usage for this session.",
    source: "builtin",
    expand: () => `Summarize this session's LLM usage:
- input tokens / output tokens / cached tokens
- estimated cost (use Anthropic / OpenAI public pricing as appropriate)
- cache hit ratio and approximate savings
Be concrete, no hedging.`
  },
  {
    name: "compact",
    description: "Manually trigger a soft-compact of the conversation history.",
    source: "builtin",
    expand: () => `[Manual compact requested]

Produce a tight handoff summary of the conversation so far covering:
- The user's overall goal
- Decisions made
- Files / functions touched
- Outstanding TODOs (if any)
Then continue from the current step.`
  },
  {
    name: "remember",
    description: "Explicitly save important information to long-term memory.",
    source: "builtin",
    expand: (arg) => arg.trim() ? `[REMEMBER REQUEST] The user explicitly asks you to remember the following information for future conversations:

"${arg.trim()}"

Call the \`upsert_memory\` tool (or equivalent) to save this to persistent memory. Classify it as: preference / project_knowledge / experience as appropriate. Confirm to the user once saved.` : `[REMEMBER REQUEST] The user wants to save the most important information from this conversation to memory.

Review the conversation and identify 1\u20133 key facts worth remembering (preferences, decisions, project-specific knowledge). Save each one via \`upsert_memory\` and list what you saved.`
  }
];
var SlashCommandRegistry = class {
  constructor(cwd) {
    this.cwd = cwd;
    for (const c of BUILTIN) this.cmds.set(c.name, c);
  }
  cwd;
  cmds = /* @__PURE__ */ new Map();
  list() {
    return [...this.cmds.values()];
  }
  get(name) {
    return this.cmds.get(name);
  }
  async loadUser() {
    const dir = path16.join(this.cwd, DIR2);
    try {
      await fs16.mkdir(dir, { recursive: true });
      const files = await fs16.readdir(dir);
      for (const f of files) {
        if (!f.endsWith(".md")) continue;
        try {
          const raw = await fs16.readFile(path16.join(dir, f), "utf-8");
          const cmd = parseUserCommand(f, raw);
          this.cmds.set(cmd.name, cmd);
        } catch (e) {
          console.warn(`[slash] failed to load ${f}:`, e.message);
        }
      }
    } catch {
    }
  }
  /** 检查消息是否以 / 开头，是的话展开。返回 null 表示无需处理。 */
  maybeExpand(message) {
    if (!message.startsWith("/")) return null;
    const m = /^\/(\w[\w-]*)\s*([\s\S]*)$/.exec(message);
    if (!m) return null;
    const [, name, arg] = m;
    const cmd = this.cmds.get(name);
    if (!cmd) return null;
    return { command: name, expanded: cmd.expand(arg) };
  }
};
function parseUserCommand(file, raw) {
  let name = file.replace(/\.md$/, "");
  let description = "";
  let body = raw;
  const fm = /^---\n([\s\S]*?)\n---\n?/m.exec(raw);
  if (fm) {
    body = raw.slice(fm[0].length);
    for (const line of fm[1].split("\n")) {
      const m = /^(\w+):\s*(.+)$/.exec(line.trim());
      if (!m) continue;
      const [, k, v] = m;
      if (k === "name") name = v.trim();
      else if (k === "description") description = v.trim();
    }
  }
  const template = body.trim();
  return {
    name,
    description: description || "(user command)",
    source: "user",
    expand: (arg) => template.replace(/\$ARG/g, arg.trim())
  };
}

// ../server/src/providers.ts
import { promises as fs17 } from "node:fs";
import path17 from "node:path";
var FILE = ".minicodeide/providers.json";
var DEFAULT = {
  profiles: [
    {
      id: "hash-fallback",
      name: "Hash Embedder (no key)",
      baseUrl: "",
      apiKey: "",
      embedModel: "hash-fnv1a-256",
      embedDim: 256,
      hash: true
    }
  ],
  active: { embed: "hash-fallback" }
};
var ProviderStore = class {
  constructor(cwd) {
    this.cwd = cwd;
    this.file = path17.join(cwd, FILE);
  }
  cwd;
  cfg = DEFAULT;
  file;
  /** 切换/upsert/delete 时触发 */
  onChange;
  async load() {
    try {
      const raw = await fs17.readFile(this.file, "utf-8");
      const parsed = JSON.parse(raw);
      this.cfg = {
        profiles: parsed.profiles ?? [],
        active: parsed.active ?? {},
        fallbacks: parsed.fallbacks ?? {}
      };
      if (!this.cfg.profiles.some((p) => p.id === "hash-fallback")) {
        this.cfg.profiles.push(DEFAULT.profiles[0]);
      }
    } catch {
      this.cfg = structuredClone(DEFAULT);
    }
    if (process.env.LLM_API_KEY) {
      const id = "env-default";
      const exists = this.cfg.profiles.find((p) => p.id === id);
      if (!exists) {
        this.cfg.profiles.unshift({
          id,
          name: "ENV Default",
          baseUrl: process.env.LLM_BASE_URL ?? "https://api.deepseek.com/v1",
          apiKey: process.env.LLM_API_KEY,
          model: process.env.LLM_MODEL ?? "deepseek-chat",
          embedModel: process.env.EMBED_MODEL
        });
      }
      if (!this.cfg.active.chat) this.cfg.active.chat = id;
      if (!this.cfg.active.complete) this.cfg.active.complete = id;
      if (!this.cfg.active.embed && process.env.EMBED_MODEL)
        this.cfg.active.embed = id;
    }
    return this.cfg;
  }
  async save() {
    await fs17.mkdir(path17.dirname(this.file), { recursive: true });
    await fs17.writeFile(this.file, JSON.stringify(this.cfg, null, 2), "utf-8");
  }
  list() {
    return {
      profiles: this.cfg.profiles.map((p) => ({
        ...p,
        apiKey: p.apiKey ? "***" + p.apiKey.slice(-4) : "",
        apiKeys: p.apiKeys?.length ? p.apiKeys.map((k) => k ? "***" + k.slice(-4) : "") : void 0
      })),
      active: this.cfg.active
    };
  }
  /** 内部用：返回完整配置（含明文 apiKey），仅供本地 syncToCloud 等内部调用 */
  getConfig() {
    return structuredClone(this.cfg);
  }
  /** 内部用：拿真实 apiKey */
  get(id) {
    return this.cfg.profiles.find((p) => p.id === id);
  }
  getActive(role) {
    const id = this.cfg.active[role];
    if (!id) return void 0;
    return this.get(id);
  }
  async upsert(p) {
    const id = p.id ?? `p_${Date.now()}`;
    const existing = this.cfg.profiles.findIndex((x) => x.id === id);
    const next = {
      id,
      name: p.name,
      kind: p.kind,
      // 'openai' | 'anthropic' | undefined (auto)
      baseUrl: p.baseUrl,
      apiKey: p.apiKey ?? (existing >= 0 ? this.cfg.profiles[existing].apiKey : ""),
      apiKeys: p.apiKeys ?? (existing >= 0 ? this.cfg.profiles[existing].apiKeys : void 0),
      model: p.model,
      embedModel: p.embedModel,
      embedDim: p.embedDim,
      hash: !!p.hash,
      supportsVision: p.supportsVision
    };
    if (existing >= 0) this.cfg.profiles[existing] = next;
    else this.cfg.profiles.push(next);
    if (!next.hash) {
      if (!this.cfg.active.chat && this.cfg.profiles.filter((p2) => !p2.hash).length <= 1) {
        this.cfg.active.chat = id;
      }
      if (!this.cfg.active.complete && this.cfg.profiles.filter((p2) => !p2.hash).length <= 1) {
        this.cfg.active.complete = id;
      }
    }
    await this.save();
    this.onChange?.();
    return next;
  }
  /** 返回某 role 的 fallback 链（按 [primary, ...fallbacks] 顺序） */
  getRoleChain(role) {
    const chain = [];
    const seen = /* @__PURE__ */ new Set();
    const push = (id) => {
      if (!id || seen.has(id)) return;
      const p = this.get(id);
      if (p) {
        chain.push(p);
        seen.add(id);
      }
    };
    push(this.cfg.active[role]);
    for (const id of this.cfg.fallbacks?.[role] ?? []) push(id);
    if (role === "fast") {
      push(this.cfg.active.chat);
      for (const id of this.cfg.fallbacks?.chat ?? []) push(id);
    }
    return chain;
  }
  async setFallbacks(role, ids) {
    if (!this.cfg.fallbacks) this.cfg.fallbacks = {};
    const clean = ids.filter((id) => this.get(id));
    this.cfg.fallbacks[role] = clean;
    await this.save();
    this.onChange?.();
  }
  async remove(id) {
    if (id === "hash-fallback") throw new Error("cannot remove fallback");
    this.cfg.profiles = this.cfg.profiles.filter((p) => p.id !== id);
    for (const k of ["chat", "complete", "embed", "fast"]) {
      if (this.cfg.active[k] === id) delete this.cfg.active[k];
    }
    await this.save();
    this.onChange?.();
  }
  async setActive(role, id) {
    if (id && !this.get(id)) throw new Error("profile not found");
    if (id) this.cfg.active[role] = id;
    else delete this.cfg.active[role];
    await this.save();
    this.onChange?.();
  }
};

// ../server/src/session-store.ts
import { promises as fs18 } from "node:fs";
import path18 from "node:path";
var SessionLock = class {
  chains = /* @__PURE__ */ new Map();
  async acquire(sessionId) {
    const prev = this.chains.get(sessionId) ?? Promise.resolve();
    let release;
    const next = new Promise((resolve3) => {
      release = resolve3;
    });
    this.chains.set(sessionId, next);
    await prev;
    return () => {
      release();
      if (this.chains.get(sessionId) === next) {
        this.chains.delete(sessionId);
      }
    };
  }
  /** 检查某个 session 是否正在被锁定（用于快速判断，不阻塞） */
  isLocked(sessionId) {
    return this.chains.has(sessionId);
  }
};
var SessionStore = class {
  dir;
  /** session id → 内存缓存（避免每次 list 都扫盘） */
  cache = /* @__PURE__ */ new Map();
  loaded = false;
  /** 并发锁：确保同一 session 的 turn 生命周期不会交叉 */
  lock = new SessionLock();
  constructor(workspace) {
    this.dir = path18.join(workspace, ".minicodeide", "sessions");
  }
  /** 启动时加载所有 session（jsonl 文件），并对老数据自动补全 mode 字段 */
  async load() {
    if (this.loaded) return;
    await fs18.mkdir(this.dir, { recursive: true });
    const files = await fs18.readdir(this.dir);
    for (const f of files) {
      if (!f.endsWith(".jsonl")) continue;
      const id = f.replace(/\.jsonl$/, "");
      try {
        const sess = await this.readJsonl(id);
        if (sess) {
          if (!sess.meta.mode) {
            sess.meta.mode = "code";
          }
          this.cache.set(id, sess);
        }
      } catch {
      }
    }
    this.loaded = true;
  }
  list() {
    return [...this.cache.values()].map((s) => s.meta).sort((a, b) => b.updatedAt - a.updatedAt);
  }
  get(id) {
    return this.cache.get(id);
  }
  async create(titleOrOpts) {
    const opts = typeof titleOrOpts === "string" ? { title: titleOrOpts } : titleOrOpts ?? {};
    const id = `sess_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const now = Date.now();
    const meta = {
      id,
      title: opts.title?.trim() || "New chat",
      createdAt: now,
      updatedAt: now,
      messageCount: 0,
      mode: opts.mode ?? "code",
      workspaceRoot: opts.workspaceRoot,
      remoteUser: opts.remoteUser
    };
    const sess = { meta, messages: [] };
    this.cache.set(id, sess);
    await this.appendLine(id, { t: "meta", ...meta });
    return meta;
  }
  /** Remote 通道：按 wxUserId 找/建 session（一个 wxUser 默认一个 active session） */
  async findOrCreateForRemote(wxUserId, opts = {}) {
    const found = [...this.cache.values()].filter((s) => s.meta.remoteUser === wxUserId).sort((a, b) => b.meta.updatedAt - a.meta.updatedAt)[0];
    if (found) return found.meta;
    return this.create({
      title: opts.title ?? `WeChat: ${wxUserId.slice(0, 8)}`,
      mode: "code",
      workspaceRoot: opts.workspace,
      remoteUser: wxUserId
    });
  }
  /** 追加一条消息；自动设置 title（首条 user 消息的前 40 字符） */
  async append(id, msg) {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    const fullMsg = { ...msg, ts: msg.ts ?? Date.now() };
    sess.messages.push(fullMsg);
    sess.meta.updatedAt = fullMsg.ts;
    sess.meta.messageCount = sess.messages.length;
    if (sess.meta.title === "New chat" && msg.role === "user" && msg.content.trim()) {
      sess.meta.title = msg.content.trim().slice(0, 40).replace(/\s+/g, " ");
      await this.appendLine(id, { t: "meta", ...sess.meta });
    }
    await this.appendLine(id, { t: "msg", ...fullMsg });
  }
  async rename(id, title) {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    sess.meta.title = title.slice(0, 80) || sess.meta.title;
    sess.meta.updatedAt = Date.now();
    await this.appendLine(id, { t: "meta", ...sess.meta });
    return sess.meta;
  }
  async delete(id) {
    if (!this.cache.has(id)) return;
    this.cache.delete(id);
    const file = path18.join(this.dir, `${id}.jsonl`);
    await fs18.unlink(file).catch(() => void 0);
  }
  // ===== Turn lifecycle (Resume 能力) =====
  /** 开始一个新 turn，写 turn_start 落盘；返回 turnId */
  async startTurn(id, userMessage) {
    const sess = this.cache.get(id);
    if (!sess) throw new Error(`Session not found: ${id}`);
    const turnId = `t_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`;
    const startedAt = Date.now();
    sess.pendingTurn = { turnId, userMessage, partialAssistant: "", startedAt };
    sess.meta.interruptedTurn = { turnId, userMessage, partialAssistant: "", startedAt };
    await this.appendLine(id, { t: "turn_start", turnId, userMessage, ts: startedAt });
    return turnId;
  }
  /** 流式 delta 落盘（每条都 append；fsync 由 SESSION_FSYNC env 控制） */
  async appendChunk(id, turnId, delta) {
    if (!delta) return;
    const sess = this.cache.get(id);
    if (!sess) return;
    if (sess.pendingTurn?.turnId !== turnId) return;
    sess.pendingTurn.partialAssistant += delta;
    if (sess.meta.interruptedTurn) sess.meta.interruptedTurn.partialAssistant = sess.pendingTurn.partialAssistant;
    await this.appendLine(id, { t: "chunk", turnId, delta, ts: Date.now() });
  }
  /** 记一次 tool 调用（便于审计 / 续接时知道做过什么） */
  async appendTool(id, turnId, payload) {
    await this.appendLine(id, { t: "tool", turnId, ts: Date.now(), ...payload });
  }
  /** 正常结束 turn：把 partial 升级为正式 assistant 消息，清空 pending */
  async endTurn(id, turnId, finalText) {
    const sess = this.cache.get(id);
    if (!sess || sess.pendingTurn?.turnId !== turnId) return;
    const text = (finalText ?? sess.pendingTurn.partialAssistant).trim();
    sess.pendingTurn = void 0;
    sess.meta.interruptedTurn = void 0;
    await this.appendLine(id, { t: "turn_end", turnId, finalText: text, ts: Date.now() });
    if (text) {
      await this.append(id, { role: "assistant", content: text });
    }
  }
  /** 主动标记为 interrupted（用户点了 stop / 服务端 catch 到 error） */
  async interruptTurn(id, turnId, reason) {
    const sess = this.cache.get(id);
    if (!sess || sess.pendingTurn?.turnId !== turnId) return;
    await this.appendLine(id, { t: "turn_interrupted", turnId, reason, ts: Date.now() });
  }
  /** Fork：复制现有 session 并截断到指定消息索引（含），创建新 session */
  async fork(srcId, untilIndex, title) {
    const src = this.cache.get(srcId);
    if (!src) throw new Error(`Source session not found: ${srcId}`);
    const cut = src.messages.slice(0, Math.min(untilIndex + 1, src.messages.length));
    const meta = await this.create(title || `Fork: ${src.meta.title}`);
    for (const m of cut) {
      await this.append(meta.id, m);
    }
    return this.cache.get(meta.id).meta;
  }
  /** 读取一个 jsonl 文件并 reduce 成 session 状态 */
  async readJsonl(id) {
    const file = path18.join(this.dir, `${id}.jsonl`);
    let raw;
    try {
      raw = await fs18.readFile(file, "utf-8");
    } catch {
      return null;
    }
    const lines = raw.split("\n").filter((l) => l.trim());
    let meta = null;
    const messages = [];
    let curTurn = null;
    for (const ln of lines) {
      try {
        const obj = JSON.parse(ln);
        if (obj.t === "meta") {
          meta = {
            id: obj.id ?? id,
            title: obj.title ?? "Untitled",
            createdAt: obj.createdAt ?? Date.now(),
            updatedAt: obj.updatedAt ?? Date.now(),
            messageCount: obj.messageCount ?? 0,
            mode: obj.mode,
            workspaceRoot: obj.workspaceRoot,
            remoteUser: obj.remoteUser
          };
        } else if (obj.t === "msg") {
          const { t, ...rest } = obj;
          messages.push(rest);
        } else if (obj.t === "turn_start") {
          curTurn = {
            turnId: obj.turnId,
            userMessage: obj.userMessage ?? "",
            partial: "",
            startedAt: obj.ts ?? Date.now()
          };
        } else if (obj.t === "chunk") {
          if (curTurn && obj.turnId === curTurn.turnId && typeof obj.delta === "string") {
            curTurn.partial += obj.delta;
          }
        } else if (obj.t === "turn_end" || obj.t === "turn_interrupted") {
          if (obj.t === "turn_end") curTurn = null;
        }
      } catch {
      }
    }
    if (!meta) {
      meta = {
        id,
        title: "Untitled",
        createdAt: Date.now(),
        updatedAt: Date.now(),
        messageCount: messages.length
      };
    }
    meta.messageCount = messages.length;
    if (curTurn) {
      meta.interruptedTurn = {
        turnId: curTurn.turnId,
        userMessage: curTurn.userMessage,
        partialAssistant: curTurn.partial,
        startedAt: curTurn.startedAt
      };
    }
    return { meta, messages };
  }
  async appendLine(id, obj) {
    const file = path18.join(this.dir, `${id}.jsonl`);
    await fs18.appendFile(file, JSON.stringify(obj) + "\n", "utf-8");
  }
};

// ../server/src/skill-store.ts
import { promises as fs19 } from "node:fs";
import path19 from "node:path";
import os3 from "node:os";

// ../../node_modules/.pnpm/chokidar@5.0.0/node_modules/chokidar/index.js
import { EventEmitter } from "node:events";
import { stat as statcb, Stats } from "node:fs";
import { readdir as readdir2, stat as stat3 } from "node:fs/promises";
import * as sp2 from "node:path";

// ../../node_modules/.pnpm/readdirp@5.0.0/node_modules/readdirp/index.js
import { lstat, readdir, realpath, stat } from "node:fs/promises";
import { join as pjoin, relative as prelative, resolve as presolve, sep as psep } from "node:path";
import { Readable } from "node:stream";
var EntryTypes = {
  FILE_TYPE: "files",
  DIR_TYPE: "directories",
  FILE_DIR_TYPE: "files_directories",
  EVERYTHING_TYPE: "all"
};
var defaultOptions = {
  root: ".",
  fileFilter: (_entryInfo) => true,
  directoryFilter: (_entryInfo) => true,
  type: EntryTypes.FILE_TYPE,
  lstat: false,
  depth: 2147483648,
  alwaysStat: false,
  highWaterMark: 4096
};
Object.freeze(defaultOptions);
var RECURSIVE_ERROR_CODE = "READDIRP_RECURSIVE_ERROR";
var NORMAL_FLOW_ERRORS = /* @__PURE__ */ new Set(["ENOENT", "EPERM", "EACCES", "ELOOP", RECURSIVE_ERROR_CODE]);
var ALL_TYPES = [
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
];
var DIR_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.DIR_TYPE,
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE
]);
var FILE_TYPES = /* @__PURE__ */ new Set([
  EntryTypes.EVERYTHING_TYPE,
  EntryTypes.FILE_DIR_TYPE,
  EntryTypes.FILE_TYPE
]);
var isNormalFlowError = (error) => NORMAL_FLOW_ERRORS.has(error.code);
var wantBigintFsStats = process.platform === "win32";
var emptyFn = (_entryInfo) => true;
var normalizeFilter = (filter) => {
  if (filter === void 0)
    return emptyFn;
  if (typeof filter === "function")
    return filter;
  if (typeof filter === "string") {
    const fl = filter.trim();
    return (entry) => entry.basename === fl;
  }
  if (Array.isArray(filter)) {
    const trItems = filter.map((item) => item.trim());
    return (entry) => trItems.some((f) => entry.basename === f);
  }
  return emptyFn;
};
var ReaddirpStream = class extends Readable {
  parents;
  reading;
  parent;
  _stat;
  _maxDepth;
  _wantsDir;
  _wantsFile;
  _wantsEverything;
  _root;
  _isDirent;
  _statsProp;
  _rdOptions;
  _fileFilter;
  _directoryFilter;
  constructor(options = {}) {
    super({
      objectMode: true,
      autoDestroy: true,
      highWaterMark: options.highWaterMark
    });
    const opts = { ...defaultOptions, ...options };
    const { root, type } = opts;
    this._fileFilter = normalizeFilter(opts.fileFilter);
    this._directoryFilter = normalizeFilter(opts.directoryFilter);
    const statMethod = opts.lstat ? lstat : stat;
    if (wantBigintFsStats) {
      this._stat = (path27) => statMethod(path27, { bigint: true });
    } else {
      this._stat = statMethod;
    }
    this._maxDepth = opts.depth != null && Number.isSafeInteger(opts.depth) ? opts.depth : defaultOptions.depth;
    this._wantsDir = type ? DIR_TYPES.has(type) : false;
    this._wantsFile = type ? FILE_TYPES.has(type) : false;
    this._wantsEverything = type === EntryTypes.EVERYTHING_TYPE;
    this._root = presolve(root);
    this._isDirent = !opts.alwaysStat;
    this._statsProp = this._isDirent ? "dirent" : "stats";
    this._rdOptions = { encoding: "utf8", withFileTypes: this._isDirent };
    this.parents = [this._exploreDir(root, 1)];
    this.reading = false;
    this.parent = void 0;
  }
  async _read(batch) {
    if (this.reading)
      return;
    this.reading = true;
    try {
      while (!this.destroyed && batch > 0) {
        const par = this.parent;
        const fil = par && par.files;
        if (fil && fil.length > 0) {
          const { path: path27, depth } = par;
          const slice = fil.splice(0, batch).map((dirent) => this._formatEntry(dirent, path27));
          const awaited = await Promise.all(slice);
          for (const entry of awaited) {
            if (!entry)
              continue;
            if (this.destroyed)
              return;
            const entryType = await this._getEntryType(entry);
            if (entryType === "directory" && this._directoryFilter(entry)) {
              if (depth <= this._maxDepth) {
                this.parents.push(this._exploreDir(entry.fullPath, depth + 1));
              }
              if (this._wantsDir) {
                this.push(entry);
                batch--;
              }
            } else if ((entryType === "file" || this._includeAsFile(entry)) && this._fileFilter(entry)) {
              if (this._wantsFile) {
                this.push(entry);
                batch--;
              }
            }
          }
        } else {
          const parent = this.parents.pop();
          if (!parent) {
            this.push(null);
            break;
          }
          this.parent = await parent;
          if (this.destroyed)
            return;
        }
      }
    } catch (error) {
      this.destroy(error);
    } finally {
      this.reading = false;
    }
  }
  async _exploreDir(path27, depth) {
    let files;
    try {
      files = await readdir(path27, this._rdOptions);
    } catch (error) {
      this._onError(error);
    }
    return { files, depth, path: path27 };
  }
  async _formatEntry(dirent, path27) {
    let entry;
    const basename4 = this._isDirent ? dirent.name : dirent;
    try {
      const fullPath = presolve(pjoin(path27, basename4));
      entry = { path: prelative(this._root, fullPath), fullPath, basename: basename4 };
      entry[this._statsProp] = this._isDirent ? dirent : await this._stat(fullPath);
    } catch (err) {
      this._onError(err);
      return;
    }
    return entry;
  }
  _onError(err) {
    if (isNormalFlowError(err) && !this.destroyed) {
      this.emit("warn", err);
    } else {
      this.destroy(err);
    }
  }
  async _getEntryType(entry) {
    if (!entry && this._statsProp in entry) {
      return "";
    }
    const stats = entry[this._statsProp];
    if (stats.isFile())
      return "file";
    if (stats.isDirectory())
      return "directory";
    if (stats && stats.isSymbolicLink()) {
      const full = entry.fullPath;
      try {
        const entryRealPath = await realpath(full);
        const entryRealPathStats = await lstat(entryRealPath);
        if (entryRealPathStats.isFile()) {
          return "file";
        }
        if (entryRealPathStats.isDirectory()) {
          const len = entryRealPath.length;
          if (full.startsWith(entryRealPath) && full.substr(len, 1) === psep) {
            const recursiveError = new Error(`Circular symlink detected: "${full}" points to "${entryRealPath}"`);
            recursiveError.code = RECURSIVE_ERROR_CODE;
            return this._onError(recursiveError);
          }
          return "directory";
        }
      } catch (error) {
        this._onError(error);
        return "";
      }
    }
  }
  _includeAsFile(entry) {
    const stats = entry && entry[this._statsProp];
    return stats && this._wantsEverything && !stats.isDirectory();
  }
};
function readdirp(root, options = {}) {
  let type = options.entryType || options.type;
  if (type === "both")
    type = EntryTypes.FILE_DIR_TYPE;
  if (type)
    options.type = type;
  if (!root) {
    throw new Error("readdirp: root argument is required. Usage: readdirp(root, options)");
  } else if (typeof root !== "string") {
    throw new TypeError("readdirp: root argument must be a string. Usage: readdirp(root, options)");
  } else if (type && !ALL_TYPES.includes(type)) {
    throw new Error(`readdirp: Invalid type passed. Use one of ${ALL_TYPES.join(", ")}`);
  }
  options.root = root;
  return new ReaddirpStream(options);
}

// ../../node_modules/.pnpm/chokidar@5.0.0/node_modules/chokidar/handler.js
import { watch as fs_watch, unwatchFile, watchFile } from "node:fs";
import { realpath as fsrealpath, lstat as lstat2, open, stat as stat2 } from "node:fs/promises";
import { type as osType } from "node:os";
import * as sp from "node:path";
var STR_DATA = "data";
var STR_END = "end";
var STR_CLOSE = "close";
var EMPTY_FN = () => {
};
var pl = process.platform;
var isWindows = pl === "win32";
var isMacos = pl === "darwin";
var isLinux = pl === "linux";
var isFreeBSD = pl === "freebsd";
var isIBMi = osType() === "OS400";
var EVENTS = {
  ALL: "all",
  READY: "ready",
  ADD: "add",
  CHANGE: "change",
  ADD_DIR: "addDir",
  UNLINK: "unlink",
  UNLINK_DIR: "unlinkDir",
  RAW: "raw",
  ERROR: "error"
};
var EV = EVENTS;
var THROTTLE_MODE_WATCH = "watch";
var statMethods = { lstat: lstat2, stat: stat2 };
var KEY_LISTENERS = "listeners";
var KEY_ERR = "errHandlers";
var KEY_RAW = "rawEmitters";
var HANDLER_KEYS = [KEY_LISTENERS, KEY_ERR, KEY_RAW];
var binaryExtensions = /* @__PURE__ */ new Set([
  "3dm",
  "3ds",
  "3g2",
  "3gp",
  "7z",
  "a",
  "aac",
  "adp",
  "afdesign",
  "afphoto",
  "afpub",
  "ai",
  "aif",
  "aiff",
  "alz",
  "ape",
  "apk",
  "appimage",
  "ar",
  "arj",
  "asf",
  "au",
  "avi",
  "bak",
  "baml",
  "bh",
  "bin",
  "bk",
  "bmp",
  "btif",
  "bz2",
  "bzip2",
  "cab",
  "caf",
  "cgm",
  "class",
  "cmx",
  "cpio",
  "cr2",
  "cur",
  "dat",
  "dcm",
  "deb",
  "dex",
  "djvu",
  "dll",
  "dmg",
  "dng",
  "doc",
  "docm",
  "docx",
  "dot",
  "dotm",
  "dra",
  "DS_Store",
  "dsk",
  "dts",
  "dtshd",
  "dvb",
  "dwg",
  "dxf",
  "ecelp4800",
  "ecelp7470",
  "ecelp9600",
  "egg",
  "eol",
  "eot",
  "epub",
  "exe",
  "f4v",
  "fbs",
  "fh",
  "fla",
  "flac",
  "flatpak",
  "fli",
  "flv",
  "fpx",
  "fst",
  "fvt",
  "g3",
  "gh",
  "gif",
  "graffle",
  "gz",
  "gzip",
  "h261",
  "h263",
  "h264",
  "icns",
  "ico",
  "ief",
  "img",
  "ipa",
  "iso",
  "jar",
  "jpeg",
  "jpg",
  "jpgv",
  "jpm",
  "jxr",
  "key",
  "ktx",
  "lha",
  "lib",
  "lvp",
  "lz",
  "lzh",
  "lzma",
  "lzo",
  "m3u",
  "m4a",
  "m4v",
  "mar",
  "mdi",
  "mht",
  "mid",
  "midi",
  "mj2",
  "mka",
  "mkv",
  "mmr",
  "mng",
  "mobi",
  "mov",
  "movie",
  "mp3",
  "mp4",
  "mp4a",
  "mpeg",
  "mpg",
  "mpga",
  "mxu",
  "nef",
  "npx",
  "numbers",
  "nupkg",
  "o",
  "odp",
  "ods",
  "odt",
  "oga",
  "ogg",
  "ogv",
  "otf",
  "ott",
  "pages",
  "pbm",
  "pcx",
  "pdb",
  "pdf",
  "pea",
  "pgm",
  "pic",
  "png",
  "pnm",
  "pot",
  "potm",
  "potx",
  "ppa",
  "ppam",
  "ppm",
  "pps",
  "ppsm",
  "ppsx",
  "ppt",
  "pptm",
  "pptx",
  "psd",
  "pya",
  "pyc",
  "pyo",
  "pyv",
  "qt",
  "rar",
  "ras",
  "raw",
  "resources",
  "rgb",
  "rip",
  "rlc",
  "rmf",
  "rmvb",
  "rpm",
  "rtf",
  "rz",
  "s3m",
  "s7z",
  "scpt",
  "sgi",
  "shar",
  "snap",
  "sil",
  "sketch",
  "slk",
  "smv",
  "snk",
  "so",
  "stl",
  "suo",
  "sub",
  "swf",
  "tar",
  "tbz",
  "tbz2",
  "tga",
  "tgz",
  "thmx",
  "tif",
  "tiff",
  "tlz",
  "ttc",
  "ttf",
  "txz",
  "udf",
  "uvh",
  "uvi",
  "uvm",
  "uvp",
  "uvs",
  "uvu",
  "viv",
  "vob",
  "war",
  "wav",
  "wax",
  "wbmp",
  "wdp",
  "weba",
  "webm",
  "webp",
  "whl",
  "wim",
  "wm",
  "wma",
  "wmv",
  "wmx",
  "woff",
  "woff2",
  "wrm",
  "wvx",
  "xbm",
  "xif",
  "xla",
  "xlam",
  "xls",
  "xlsb",
  "xlsm",
  "xlsx",
  "xlt",
  "xltm",
  "xltx",
  "xm",
  "xmind",
  "xpi",
  "xpm",
  "xwd",
  "xz",
  "z",
  "zip",
  "zipx"
]);
var isBinaryPath = (filePath) => binaryExtensions.has(sp.extname(filePath).slice(1).toLowerCase());
var foreach = (val, fn) => {
  if (val instanceof Set) {
    val.forEach(fn);
  } else {
    fn(val);
  }
};
var addAndConvert = (main2, prop, item) => {
  let container = main2[prop];
  if (!(container instanceof Set)) {
    main2[prop] = container = /* @__PURE__ */ new Set([container]);
  }
  container.add(item);
};
var clearItem = (cont) => (key) => {
  const set = cont[key];
  if (set instanceof Set) {
    set.clear();
  } else {
    delete cont[key];
  }
};
var delFromSet = (main2, prop, item) => {
  const container = main2[prop];
  if (container instanceof Set) {
    container.delete(item);
  } else if (container === item) {
    delete main2[prop];
  }
};
var isEmptySet = (val) => val instanceof Set ? val.size === 0 : !val;
var FsWatchInstances = /* @__PURE__ */ new Map();
function createFsWatchInstance(path27, options, listener, errHandler, emitRaw) {
  const handleEvent = (rawEvent, evPath) => {
    listener(path27);
    emitRaw(rawEvent, evPath, { watchedPath: path27 });
    if (evPath && path27 !== evPath) {
      fsWatchBroadcast(sp.resolve(path27, evPath), KEY_LISTENERS, sp.join(path27, evPath));
    }
  };
  try {
    return fs_watch(path27, {
      persistent: options.persistent
    }, handleEvent);
  } catch (error) {
    errHandler(error);
    return void 0;
  }
}
var fsWatchBroadcast = (fullPath, listenerType, val1, val2, val3) => {
  const cont = FsWatchInstances.get(fullPath);
  if (!cont)
    return;
  foreach(cont[listenerType], (listener) => {
    listener(val1, val2, val3);
  });
};
var setFsWatchListener = (path27, fullPath, options, handlers) => {
  const { listener, errHandler, rawEmitter } = handlers;
  let cont = FsWatchInstances.get(fullPath);
  let watcher;
  if (!options.persistent) {
    watcher = createFsWatchInstance(path27, options, listener, errHandler, rawEmitter);
    if (!watcher)
      return;
    return watcher.close.bind(watcher);
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_ERR, errHandler);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    watcher = createFsWatchInstance(
      path27,
      options,
      fsWatchBroadcast.bind(null, fullPath, KEY_LISTENERS),
      errHandler,
      // no need to use broadcast here
      fsWatchBroadcast.bind(null, fullPath, KEY_RAW)
    );
    if (!watcher)
      return;
    watcher.on(EV.ERROR, async (error) => {
      const broadcastErr = fsWatchBroadcast.bind(null, fullPath, KEY_ERR);
      if (cont)
        cont.watcherUnusable = true;
      if (isWindows && error.code === "EPERM") {
        try {
          const fd = await open(path27, "r");
          await fd.close();
          broadcastErr(error);
        } catch (err) {
        }
      } else {
        broadcastErr(error);
      }
    });
    cont = {
      listeners: listener,
      errHandlers: errHandler,
      rawEmitters: rawEmitter,
      watcher
    };
    FsWatchInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_ERR, errHandler);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      cont.watcher.close();
      FsWatchInstances.delete(fullPath);
      HANDLER_KEYS.forEach(clearItem(cont));
      cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
var FsWatchFileInstances = /* @__PURE__ */ new Map();
var setFsWatchFileListener = (path27, fullPath, options, handlers) => {
  const { listener, rawEmitter } = handlers;
  let cont = FsWatchFileInstances.get(fullPath);
  const copts = cont && cont.options;
  if (copts && (copts.persistent < options.persistent || copts.interval > options.interval)) {
    unwatchFile(fullPath);
    cont = void 0;
  }
  if (cont) {
    addAndConvert(cont, KEY_LISTENERS, listener);
    addAndConvert(cont, KEY_RAW, rawEmitter);
  } else {
    cont = {
      listeners: listener,
      rawEmitters: rawEmitter,
      options,
      watcher: watchFile(fullPath, options, (curr, prev) => {
        foreach(cont.rawEmitters, (rawEmitter2) => {
          rawEmitter2(EV.CHANGE, fullPath, { curr, prev });
        });
        const currmtime = curr.mtimeMs;
        if (curr.size !== prev.size || currmtime > prev.mtimeMs || currmtime === 0) {
          foreach(cont.listeners, (listener2) => listener2(path27, curr));
        }
      })
    };
    FsWatchFileInstances.set(fullPath, cont);
  }
  return () => {
    delFromSet(cont, KEY_LISTENERS, listener);
    delFromSet(cont, KEY_RAW, rawEmitter);
    if (isEmptySet(cont.listeners)) {
      FsWatchFileInstances.delete(fullPath);
      unwatchFile(fullPath);
      cont.options = cont.watcher = void 0;
      Object.freeze(cont);
    }
  };
};
var NodeFsHandler = class {
  fsw;
  _boundHandleError;
  constructor(fsW) {
    this.fsw = fsW;
    this._boundHandleError = (error) => fsW._handleError(error);
  }
  /**
   * Watch file for changes with fs_watchFile or fs_watch.
   * @param path to file or dir
   * @param listener on fs change
   * @returns closer for the watcher instance
   */
  _watchWithNodeFs(path27, listener) {
    const opts = this.fsw.options;
    const directory = sp.dirname(path27);
    const basename4 = sp.basename(path27);
    const parent = this.fsw._getWatchedDir(directory);
    parent.add(basename4);
    const absolutePath = sp.resolve(path27);
    const options = {
      persistent: opts.persistent
    };
    if (!listener)
      listener = EMPTY_FN;
    let closer;
    if (opts.usePolling) {
      const enableBin = opts.interval !== opts.binaryInterval;
      options.interval = enableBin && isBinaryPath(basename4) ? opts.binaryInterval : opts.interval;
      closer = setFsWatchFileListener(path27, absolutePath, options, {
        listener,
        rawEmitter: this.fsw._emitRaw
      });
    } else {
      closer = setFsWatchListener(path27, absolutePath, options, {
        listener,
        errHandler: this._boundHandleError,
        rawEmitter: this.fsw._emitRaw
      });
    }
    return closer;
  }
  /**
   * Watch a file and emit add event if warranted.
   * @returns closer for the watcher instance
   */
  _handleFile(file, stats, initialAdd) {
    if (this.fsw.closed) {
      return;
    }
    const dirname3 = sp.dirname(file);
    const basename4 = sp.basename(file);
    const parent = this.fsw._getWatchedDir(dirname3);
    let prevStats = stats;
    if (parent.has(basename4))
      return;
    const listener = async (path27, newStats) => {
      if (!this.fsw._throttle(THROTTLE_MODE_WATCH, file, 5))
        return;
      if (!newStats || newStats.mtimeMs === 0) {
        try {
          const newStats2 = await stat2(file);
          if (this.fsw.closed)
            return;
          const at = newStats2.atimeMs;
          const mt = newStats2.mtimeMs;
          if (!at || at <= mt || mt !== prevStats.mtimeMs) {
            this.fsw._emit(EV.CHANGE, file, newStats2);
          }
          if ((isMacos || isLinux || isFreeBSD) && prevStats.ino !== newStats2.ino) {
            this.fsw._closeFile(path27);
            prevStats = newStats2;
            const closer2 = this._watchWithNodeFs(file, listener);
            if (closer2)
              this.fsw._addPathCloser(path27, closer2);
          } else {
            prevStats = newStats2;
          }
        } catch (error) {
          this.fsw._remove(dirname3, basename4);
        }
      } else if (parent.has(basename4)) {
        const at = newStats.atimeMs;
        const mt = newStats.mtimeMs;
        if (!at || at <= mt || mt !== prevStats.mtimeMs) {
          this.fsw._emit(EV.CHANGE, file, newStats);
        }
        prevStats = newStats;
      }
    };
    const closer = this._watchWithNodeFs(file, listener);
    if (!(initialAdd && this.fsw.options.ignoreInitial) && this.fsw._isntIgnored(file)) {
      if (!this.fsw._throttle(EV.ADD, file, 0))
        return;
      this.fsw._emit(EV.ADD, file, stats);
    }
    return closer;
  }
  /**
   * Handle symlinks encountered while reading a dir.
   * @param entry returned by readdirp
   * @param directory path of dir being read
   * @param path of this item
   * @param item basename of this item
   * @returns true if no more processing is needed for this entry.
   */
  async _handleSymlink(entry, directory, path27, item) {
    if (this.fsw.closed) {
      return;
    }
    const full = entry.fullPath;
    const dir = this.fsw._getWatchedDir(directory);
    if (!this.fsw.options.followSymlinks) {
      this.fsw._incrReadyCount();
      let linkPath;
      try {
        linkPath = await fsrealpath(path27);
      } catch (e) {
        this.fsw._emitReady();
        return true;
      }
      if (this.fsw.closed)
        return;
      if (dir.has(item)) {
        if (this.fsw._symlinkPaths.get(full) !== linkPath) {
          this.fsw._symlinkPaths.set(full, linkPath);
          this.fsw._emit(EV.CHANGE, path27, entry.stats);
        }
      } else {
        dir.add(item);
        this.fsw._symlinkPaths.set(full, linkPath);
        this.fsw._emit(EV.ADD, path27, entry.stats);
      }
      this.fsw._emitReady();
      return true;
    }
    if (this.fsw._symlinkPaths.has(full)) {
      return true;
    }
    this.fsw._symlinkPaths.set(full, true);
  }
  _handleRead(directory, initialAdd, wh, target, dir, depth, throttler) {
    directory = sp.join(directory, "");
    const throttleKey = target ? `${directory}:${target}` : directory;
    throttler = this.fsw._throttle("readdir", throttleKey, 1e3);
    if (!throttler)
      return;
    const previous = this.fsw._getWatchedDir(wh.path);
    const current = /* @__PURE__ */ new Set();
    let stream = this.fsw._readdirp(directory, {
      fileFilter: (entry) => wh.filterPath(entry),
      directoryFilter: (entry) => wh.filterDir(entry)
    });
    if (!stream)
      return;
    stream.on(STR_DATA, async (entry) => {
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      const item = entry.path;
      let path27 = sp.join(directory, item);
      current.add(item);
      if (entry.stats.isSymbolicLink() && await this._handleSymlink(entry, directory, path27, item)) {
        return;
      }
      if (this.fsw.closed) {
        stream = void 0;
        return;
      }
      if (item === target || !target && !previous.has(item)) {
        this.fsw._incrReadyCount();
        path27 = sp.join(dir, sp.relative(dir, path27));
        this._addToNodeFs(path27, initialAdd, wh, depth + 1);
      }
    }).on(EV.ERROR, this._boundHandleError);
    return new Promise((resolve3, reject) => {
      if (!stream)
        return reject();
      stream.once(STR_END, () => {
        if (this.fsw.closed) {
          stream = void 0;
          return;
        }
        const wasThrottled = throttler ? throttler.clear() : false;
        resolve3(void 0);
        previous.getChildren().filter((item) => {
          return item !== directory && !current.has(item);
        }).forEach((item) => {
          this.fsw._remove(directory, item);
        });
        stream = void 0;
        if (wasThrottled)
          this._handleRead(directory, false, wh, target, dir, depth, throttler);
      });
    });
  }
  /**
   * Read directory to add / remove files from `@watched` list and re-read it on change.
   * @param dir fs path
   * @param stats
   * @param initialAdd
   * @param depth relative to user-supplied path
   * @param target child path targeted for watch
   * @param wh Common watch helpers for this path
   * @param realpath
   * @returns closer for the watcher instance.
   */
  async _handleDir(dir, stats, initialAdd, depth, target, wh, realpath2) {
    const parentDir = this.fsw._getWatchedDir(sp.dirname(dir));
    const tracked = parentDir.has(sp.basename(dir));
    if (!(initialAdd && this.fsw.options.ignoreInitial) && !target && !tracked) {
      this.fsw._emit(EV.ADD_DIR, dir, stats);
    }
    parentDir.add(sp.basename(dir));
    this.fsw._getWatchedDir(dir);
    let throttler;
    let closer;
    const oDepth = this.fsw.options.depth;
    if ((oDepth == null || depth <= oDepth) && !this.fsw._symlinkPaths.has(realpath2)) {
      if (!target) {
        await this._handleRead(dir, initialAdd, wh, target, dir, depth, throttler);
        if (this.fsw.closed)
          return;
      }
      closer = this._watchWithNodeFs(dir, (dirPath, stats2) => {
        if (stats2 && stats2.mtimeMs === 0)
          return;
        this._handleRead(dirPath, false, wh, target, dir, depth, throttler);
      });
    }
    return closer;
  }
  /**
   * Handle added file, directory, or glob pattern.
   * Delegates call to _handleFile / _handleDir after checks.
   * @param path to file or ir
   * @param initialAdd was the file added at watch instantiation?
   * @param priorWh depth relative to user-supplied path
   * @param depth Child path actually targeted for watch
   * @param target Child path actually targeted for watch
   */
  async _addToNodeFs(path27, initialAdd, priorWh, depth, target) {
    const ready = this.fsw._emitReady;
    if (this.fsw._isIgnored(path27) || this.fsw.closed) {
      ready();
      return false;
    }
    const wh = this.fsw._getWatchHelpers(path27);
    if (priorWh) {
      wh.filterPath = (entry) => priorWh.filterPath(entry);
      wh.filterDir = (entry) => priorWh.filterDir(entry);
    }
    try {
      const stats = await statMethods[wh.statMethod](wh.watchPath);
      if (this.fsw.closed)
        return;
      if (this.fsw._isIgnored(wh.watchPath, stats)) {
        ready();
        return false;
      }
      const follow = this.fsw.options.followSymlinks;
      let closer;
      if (stats.isDirectory()) {
        const absPath = sp.resolve(path27);
        const targetPath = follow ? await fsrealpath(path27) : path27;
        if (this.fsw.closed)
          return;
        closer = await this._handleDir(wh.watchPath, stats, initialAdd, depth, target, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (absPath !== targetPath && targetPath !== void 0) {
          this.fsw._symlinkPaths.set(absPath, targetPath);
        }
      } else if (stats.isSymbolicLink()) {
        const targetPath = follow ? await fsrealpath(path27) : path27;
        if (this.fsw.closed)
          return;
        const parent = sp.dirname(wh.watchPath);
        this.fsw._getWatchedDir(parent).add(wh.watchPath);
        this.fsw._emit(EV.ADD, wh.watchPath, stats);
        closer = await this._handleDir(parent, stats, initialAdd, depth, path27, wh, targetPath);
        if (this.fsw.closed)
          return;
        if (targetPath !== void 0) {
          this.fsw._symlinkPaths.set(sp.resolve(path27), targetPath);
        }
      } else {
        closer = this._handleFile(wh.watchPath, stats, initialAdd);
      }
      ready();
      if (closer)
        this.fsw._addPathCloser(path27, closer);
      return false;
    } catch (error) {
      if (this.fsw._handleError(error)) {
        ready();
        return path27;
      }
    }
  }
};

// ../../node_modules/.pnpm/chokidar@5.0.0/node_modules/chokidar/index.js
var SLASH = "/";
var SLASH_SLASH = "//";
var ONE_DOT = ".";
var TWO_DOTS = "..";
var STRING_TYPE = "string";
var BACK_SLASH_RE = /\\/g;
var DOUBLE_SLASH_RE = /\/\//g;
var DOT_RE = /\..*\.(sw[px])$|~$|\.subl.*\.tmp/;
var REPLACER_RE = /^\.[/\\]/;
function arrify(item) {
  return Array.isArray(item) ? item : [item];
}
var isMatcherObject = (matcher) => typeof matcher === "object" && matcher !== null && !(matcher instanceof RegExp);
function createPattern(matcher) {
  if (typeof matcher === "function")
    return matcher;
  if (typeof matcher === "string")
    return (string) => matcher === string;
  if (matcher instanceof RegExp)
    return (string) => matcher.test(string);
  if (typeof matcher === "object" && matcher !== null) {
    return (string) => {
      if (matcher.path === string)
        return true;
      if (matcher.recursive) {
        const relative5 = sp2.relative(matcher.path, string);
        if (!relative5) {
          return false;
        }
        return !relative5.startsWith("..") && !sp2.isAbsolute(relative5);
      }
      return false;
    };
  }
  return () => false;
}
function normalizePath(path27) {
  if (typeof path27 !== "string")
    throw new Error("string expected");
  path27 = sp2.normalize(path27);
  path27 = path27.replace(/\\/g, "/");
  let prepend = false;
  if (path27.startsWith("//"))
    prepend = true;
  path27 = path27.replace(DOUBLE_SLASH_RE, "/");
  if (prepend)
    path27 = "/" + path27;
  return path27;
}
function matchPatterns(patterns, testString, stats) {
  const path27 = normalizePath(testString);
  for (let index = 0; index < patterns.length; index++) {
    const pattern = patterns[index];
    if (pattern(path27, stats)) {
      return true;
    }
  }
  return false;
}
function anymatch(matchers, testString) {
  if (matchers == null) {
    throw new TypeError("anymatch: specify first argument");
  }
  const matchersArray = arrify(matchers);
  const patterns = matchersArray.map((matcher) => createPattern(matcher));
  if (testString == null) {
    return (testString2, stats) => {
      return matchPatterns(patterns, testString2, stats);
    };
  }
  return matchPatterns(patterns, testString);
}
var unifyPaths = (paths_) => {
  const paths = arrify(paths_).flat();
  if (!paths.every((p) => typeof p === STRING_TYPE)) {
    throw new TypeError(`Non-string provided as watch path: ${paths}`);
  }
  return paths.map(normalizePathToUnix);
};
var toUnix = (string) => {
  let str = string.replace(BACK_SLASH_RE, SLASH);
  let prepend = false;
  if (str.startsWith(SLASH_SLASH)) {
    prepend = true;
  }
  str = str.replace(DOUBLE_SLASH_RE, SLASH);
  if (prepend) {
    str = SLASH + str;
  }
  return str;
};
var normalizePathToUnix = (path27) => toUnix(sp2.normalize(toUnix(path27)));
var normalizeIgnored = (cwd = "") => (path27) => {
  if (typeof path27 === "string") {
    return normalizePathToUnix(sp2.isAbsolute(path27) ? path27 : sp2.join(cwd, path27));
  } else {
    return path27;
  }
};
var getAbsolutePath = (path27, cwd) => {
  if (sp2.isAbsolute(path27)) {
    return path27;
  }
  return sp2.join(cwd, path27);
};
var EMPTY_SET = Object.freeze(/* @__PURE__ */ new Set());
var DirEntry = class {
  path;
  _removeWatcher;
  items;
  constructor(dir, removeWatcher) {
    this.path = dir;
    this._removeWatcher = removeWatcher;
    this.items = /* @__PURE__ */ new Set();
  }
  add(item) {
    const { items } = this;
    if (!items)
      return;
    if (item !== ONE_DOT && item !== TWO_DOTS)
      items.add(item);
  }
  async remove(item) {
    const { items } = this;
    if (!items)
      return;
    items.delete(item);
    if (items.size > 0)
      return;
    const dir = this.path;
    try {
      await readdir2(dir);
    } catch (err) {
      if (this._removeWatcher) {
        this._removeWatcher(sp2.dirname(dir), sp2.basename(dir));
      }
    }
  }
  has(item) {
    const { items } = this;
    if (!items)
      return;
    return items.has(item);
  }
  getChildren() {
    const { items } = this;
    if (!items)
      return [];
    return [...items.values()];
  }
  dispose() {
    this.items.clear();
    this.path = "";
    this._removeWatcher = EMPTY_FN;
    this.items = EMPTY_SET;
    Object.freeze(this);
  }
};
var STAT_METHOD_F = "stat";
var STAT_METHOD_L = "lstat";
var WatchHelper = class {
  fsw;
  path;
  watchPath;
  fullWatchPath;
  dirParts;
  followSymlinks;
  statMethod;
  constructor(path27, follow, fsw) {
    this.fsw = fsw;
    const watchPath = path27;
    this.path = path27 = path27.replace(REPLACER_RE, "");
    this.watchPath = watchPath;
    this.fullWatchPath = sp2.resolve(watchPath);
    this.dirParts = [];
    this.dirParts.forEach((parts) => {
      if (parts.length > 1)
        parts.pop();
    });
    this.followSymlinks = follow;
    this.statMethod = follow ? STAT_METHOD_F : STAT_METHOD_L;
  }
  entryPath(entry) {
    return sp2.join(this.watchPath, sp2.relative(this.watchPath, entry.fullPath));
  }
  filterPath(entry) {
    const { stats } = entry;
    if (stats && stats.isSymbolicLink())
      return this.filterDir(entry);
    const resolvedPath = this.entryPath(entry);
    return this.fsw._isntIgnored(resolvedPath, stats) && this.fsw._hasReadPermissions(stats);
  }
  filterDir(entry) {
    return this.fsw._isntIgnored(this.entryPath(entry), entry.stats);
  }
};
var FSWatcher = class extends EventEmitter {
  closed;
  options;
  _closers;
  _ignoredPaths;
  _throttled;
  _streams;
  _symlinkPaths;
  _watched;
  _pendingWrites;
  _pendingUnlinks;
  _readyCount;
  _emitReady;
  _closePromise;
  _userIgnored;
  _readyEmitted;
  _emitRaw;
  _boundRemove;
  _nodeFsHandler;
  // Not indenting methods for history sake; for now.
  constructor(_opts = {}) {
    super();
    this.closed = false;
    this._closers = /* @__PURE__ */ new Map();
    this._ignoredPaths = /* @__PURE__ */ new Set();
    this._throttled = /* @__PURE__ */ new Map();
    this._streams = /* @__PURE__ */ new Set();
    this._symlinkPaths = /* @__PURE__ */ new Map();
    this._watched = /* @__PURE__ */ new Map();
    this._pendingWrites = /* @__PURE__ */ new Map();
    this._pendingUnlinks = /* @__PURE__ */ new Map();
    this._readyCount = 0;
    this._readyEmitted = false;
    const awf = _opts.awaitWriteFinish;
    const DEF_AWF = { stabilityThreshold: 2e3, pollInterval: 100 };
    const opts = {
      // Defaults
      persistent: true,
      ignoreInitial: false,
      ignorePermissionErrors: false,
      interval: 100,
      binaryInterval: 300,
      followSymlinks: true,
      usePolling: false,
      // useAsync: false,
      atomic: true,
      // NOTE: overwritten later (depends on usePolling)
      ..._opts,
      // Change format
      ignored: _opts.ignored ? arrify(_opts.ignored) : arrify([]),
      awaitWriteFinish: awf === true ? DEF_AWF : typeof awf === "object" ? { ...DEF_AWF, ...awf } : false
    };
    if (isIBMi)
      opts.usePolling = true;
    if (opts.atomic === void 0)
      opts.atomic = !opts.usePolling;
    const envPoll = process.env.CHOKIDAR_USEPOLLING;
    if (envPoll !== void 0) {
      const envLower = envPoll.toLowerCase();
      if (envLower === "false" || envLower === "0")
        opts.usePolling = false;
      else if (envLower === "true" || envLower === "1")
        opts.usePolling = true;
      else
        opts.usePolling = !!envLower;
    }
    const envInterval = process.env.CHOKIDAR_INTERVAL;
    if (envInterval)
      opts.interval = Number.parseInt(envInterval, 10);
    let readyCalls = 0;
    this._emitReady = () => {
      readyCalls++;
      if (readyCalls >= this._readyCount) {
        this._emitReady = EMPTY_FN;
        this._readyEmitted = true;
        process.nextTick(() => this.emit(EVENTS.READY));
      }
    };
    this._emitRaw = (...args) => this.emit(EVENTS.RAW, ...args);
    this._boundRemove = this._remove.bind(this);
    this.options = opts;
    this._nodeFsHandler = new NodeFsHandler(this);
    Object.freeze(opts);
  }
  _addIgnoredPath(matcher) {
    if (isMatcherObject(matcher)) {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher.path && ignored.recursive === matcher.recursive) {
          return;
        }
      }
    }
    this._ignoredPaths.add(matcher);
  }
  _removeIgnoredPath(matcher) {
    this._ignoredPaths.delete(matcher);
    if (typeof matcher === "string") {
      for (const ignored of this._ignoredPaths) {
        if (isMatcherObject(ignored) && ignored.path === matcher) {
          this._ignoredPaths.delete(ignored);
        }
      }
    }
  }
  // Public methods
  /**
   * Adds paths to be watched on an existing FSWatcher instance.
   * @param paths_ file or file list. Other arguments are unused
   */
  add(paths_, _origAdd, _internal) {
    const { cwd } = this.options;
    this.closed = false;
    this._closePromise = void 0;
    let paths = unifyPaths(paths_);
    if (cwd) {
      paths = paths.map((path27) => {
        const absPath = getAbsolutePath(path27, cwd);
        return absPath;
      });
    }
    paths.forEach((path27) => {
      this._removeIgnoredPath(path27);
    });
    this._userIgnored = void 0;
    if (!this._readyCount)
      this._readyCount = 0;
    this._readyCount += paths.length;
    Promise.all(paths.map(async (path27) => {
      const res = await this._nodeFsHandler._addToNodeFs(path27, !_internal, void 0, 0, _origAdd);
      if (res)
        this._emitReady();
      return res;
    })).then((results) => {
      if (this.closed)
        return;
      results.forEach((item) => {
        if (item)
          this.add(sp2.dirname(item), sp2.basename(_origAdd || item));
      });
    });
    return this;
  }
  /**
   * Close watchers or start ignoring events from specified paths.
   */
  unwatch(paths_) {
    if (this.closed)
      return this;
    const paths = unifyPaths(paths_);
    const { cwd } = this.options;
    paths.forEach((path27) => {
      if (!sp2.isAbsolute(path27) && !this._closers.has(path27)) {
        if (cwd)
          path27 = sp2.join(cwd, path27);
        path27 = sp2.resolve(path27);
      }
      this._closePath(path27);
      this._addIgnoredPath(path27);
      if (this._watched.has(path27)) {
        this._addIgnoredPath({
          path: path27,
          recursive: true
        });
      }
      this._userIgnored = void 0;
    });
    return this;
  }
  /**
   * Close watchers and remove all listeners from watched paths.
   */
  close() {
    if (this._closePromise) {
      return this._closePromise;
    }
    this.closed = true;
    this.removeAllListeners();
    const closers = [];
    this._closers.forEach((closerList) => closerList.forEach((closer) => {
      const promise = closer();
      if (promise instanceof Promise)
        closers.push(promise);
    }));
    this._streams.forEach((stream) => stream.destroy());
    this._userIgnored = void 0;
    this._readyCount = 0;
    this._readyEmitted = false;
    this._watched.forEach((dirent) => dirent.dispose());
    this._closers.clear();
    this._watched.clear();
    this._streams.clear();
    this._symlinkPaths.clear();
    this._throttled.clear();
    this._closePromise = closers.length ? Promise.all(closers).then(() => void 0) : Promise.resolve();
    return this._closePromise;
  }
  /**
   * Expose list of watched paths
   * @returns for chaining
   */
  getWatched() {
    const watchList = {};
    this._watched.forEach((entry, dir) => {
      const key = this.options.cwd ? sp2.relative(this.options.cwd, dir) : dir;
      const index = key || ONE_DOT;
      watchList[index] = entry.getChildren().sort();
    });
    return watchList;
  }
  emitWithAll(event, args) {
    this.emit(event, ...args);
    if (event !== EVENTS.ERROR)
      this.emit(EVENTS.ALL, event, ...args);
  }
  // Common helpers
  // --------------
  /**
   * Normalize and emit events.
   * Calling _emit DOES NOT MEAN emit() would be called!
   * @param event Type of event
   * @param path File or directory path
   * @param stats arguments to be passed with event
   * @returns the error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  async _emit(event, path27, stats) {
    if (this.closed)
      return;
    const opts = this.options;
    if (isWindows)
      path27 = sp2.normalize(path27);
    if (opts.cwd)
      path27 = sp2.relative(opts.cwd, path27);
    const args = [path27];
    if (stats != null)
      args.push(stats);
    const awf = opts.awaitWriteFinish;
    let pw;
    if (awf && (pw = this._pendingWrites.get(path27))) {
      pw.lastChange = /* @__PURE__ */ new Date();
      return this;
    }
    if (opts.atomic) {
      if (event === EVENTS.UNLINK) {
        this._pendingUnlinks.set(path27, [event, ...args]);
        setTimeout(() => {
          this._pendingUnlinks.forEach((entry, path28) => {
            this.emit(...entry);
            this.emit(EVENTS.ALL, ...entry);
            this._pendingUnlinks.delete(path28);
          });
        }, typeof opts.atomic === "number" ? opts.atomic : 100);
        return this;
      }
      if (event === EVENTS.ADD && this._pendingUnlinks.has(path27)) {
        event = EVENTS.CHANGE;
        this._pendingUnlinks.delete(path27);
      }
    }
    if (awf && (event === EVENTS.ADD || event === EVENTS.CHANGE) && this._readyEmitted) {
      const awfEmit = (err, stats2) => {
        if (err) {
          event = EVENTS.ERROR;
          args[0] = err;
          this.emitWithAll(event, args);
        } else if (stats2) {
          if (args.length > 1) {
            args[1] = stats2;
          } else {
            args.push(stats2);
          }
          this.emitWithAll(event, args);
        }
      };
      this._awaitWriteFinish(path27, awf.stabilityThreshold, event, awfEmit);
      return this;
    }
    if (event === EVENTS.CHANGE) {
      const isThrottled = !this._throttle(EVENTS.CHANGE, path27, 50);
      if (isThrottled)
        return this;
    }
    if (opts.alwaysStat && stats === void 0 && (event === EVENTS.ADD || event === EVENTS.ADD_DIR || event === EVENTS.CHANGE)) {
      const fullPath = opts.cwd ? sp2.join(opts.cwd, path27) : path27;
      let stats2;
      try {
        stats2 = await stat3(fullPath);
      } catch (err) {
      }
      if (!stats2 || this.closed)
        return;
      args.push(stats2);
    }
    this.emitWithAll(event, args);
    return this;
  }
  /**
   * Common handler for errors
   * @returns The error if defined, otherwise the value of the FSWatcher instance's `closed` flag
   */
  _handleError(error) {
    const code = error && error.code;
    if (error && code !== "ENOENT" && code !== "ENOTDIR" && (!this.options.ignorePermissionErrors || code !== "EPERM" && code !== "EACCES")) {
      this.emit(EVENTS.ERROR, error);
    }
    return error || this.closed;
  }
  /**
   * Helper utility for throttling
   * @param actionType type being throttled
   * @param path being acted upon
   * @param timeout duration of time to suppress duplicate actions
   * @returns tracking object or false if action should be suppressed
   */
  _throttle(actionType, path27, timeout) {
    if (!this._throttled.has(actionType)) {
      this._throttled.set(actionType, /* @__PURE__ */ new Map());
    }
    const action = this._throttled.get(actionType);
    if (!action)
      throw new Error("invalid throttle");
    const actionPath = action.get(path27);
    if (actionPath) {
      actionPath.count++;
      return false;
    }
    let timeoutObject;
    const clear = () => {
      const item = action.get(path27);
      const count = item ? item.count : 0;
      action.delete(path27);
      clearTimeout(timeoutObject);
      if (item)
        clearTimeout(item.timeoutObject);
      return count;
    };
    timeoutObject = setTimeout(clear, timeout);
    const thr = { timeoutObject, clear, count: 0 };
    action.set(path27, thr);
    return thr;
  }
  _incrReadyCount() {
    return this._readyCount++;
  }
  /**
   * Awaits write operation to finish.
   * Polls a newly created file for size variations. When files size does not change for 'threshold' milliseconds calls callback.
   * @param path being acted upon
   * @param threshold Time in milliseconds a file size must be fixed before acknowledging write OP is finished
   * @param event
   * @param awfEmit Callback to be called when ready for event to be emitted.
   */
  _awaitWriteFinish(path27, threshold, event, awfEmit) {
    const awf = this.options.awaitWriteFinish;
    if (typeof awf !== "object")
      return;
    const pollInterval = awf.pollInterval;
    let timeoutHandler;
    let fullPath = path27;
    if (this.options.cwd && !sp2.isAbsolute(path27)) {
      fullPath = sp2.join(this.options.cwd, path27);
    }
    const now = /* @__PURE__ */ new Date();
    const writes = this._pendingWrites;
    function awaitWriteFinishFn(prevStat) {
      statcb(fullPath, (err, curStat) => {
        if (err || !writes.has(path27)) {
          if (err && err.code !== "ENOENT")
            awfEmit(err);
          return;
        }
        const now2 = Number(/* @__PURE__ */ new Date());
        if (prevStat && curStat.size !== prevStat.size) {
          writes.get(path27).lastChange = now2;
        }
        const pw = writes.get(path27);
        const df = now2 - pw.lastChange;
        if (df >= threshold) {
          writes.delete(path27);
          awfEmit(void 0, curStat);
        } else {
          timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval, curStat);
        }
      });
    }
    if (!writes.has(path27)) {
      writes.set(path27, {
        lastChange: now,
        cancelWait: () => {
          writes.delete(path27);
          clearTimeout(timeoutHandler);
          return event;
        }
      });
      timeoutHandler = setTimeout(awaitWriteFinishFn, pollInterval);
    }
  }
  /**
   * Determines whether user has asked to ignore this path.
   */
  _isIgnored(path27, stats) {
    if (this.options.atomic && DOT_RE.test(path27))
      return true;
    if (!this._userIgnored) {
      const { cwd } = this.options;
      const ign = this.options.ignored;
      const ignored = (ign || []).map(normalizeIgnored(cwd));
      const ignoredPaths = [...this._ignoredPaths];
      const list = [...ignoredPaths.map(normalizeIgnored(cwd)), ...ignored];
      this._userIgnored = anymatch(list, void 0);
    }
    return this._userIgnored(path27, stats);
  }
  _isntIgnored(path27, stat4) {
    return !this._isIgnored(path27, stat4);
  }
  /**
   * Provides a set of common helpers and properties relating to symlink handling.
   * @param path file or directory pattern being watched
   */
  _getWatchHelpers(path27) {
    return new WatchHelper(path27, this.options.followSymlinks, this);
  }
  // Directory helpers
  // -----------------
  /**
   * Provides directory tracking objects
   * @param directory path of the directory
   */
  _getWatchedDir(directory) {
    const dir = sp2.resolve(directory);
    if (!this._watched.has(dir))
      this._watched.set(dir, new DirEntry(dir, this._boundRemove));
    return this._watched.get(dir);
  }
  // File helpers
  // ------------
  /**
   * Check for read permissions: https://stackoverflow.com/a/11781404/1358405
   */
  _hasReadPermissions(stats) {
    if (this.options.ignorePermissionErrors)
      return true;
    return Boolean(Number(stats.mode) & 256);
  }
  /**
   * Handles emitting unlink events for
   * files and directories, and via recursion, for
   * files and directories within directories that are unlinked
   * @param directory within which the following item is located
   * @param item      base path of item/directory
   */
  _remove(directory, item, isDirectory) {
    const path27 = sp2.join(directory, item);
    const fullPath = sp2.resolve(path27);
    isDirectory = isDirectory != null ? isDirectory : this._watched.has(path27) || this._watched.has(fullPath);
    if (!this._throttle("remove", path27, 100))
      return;
    if (!isDirectory && this._watched.size === 1) {
      this.add(directory, item, true);
    }
    const wp = this._getWatchedDir(path27);
    const nestedDirectoryChildren = wp.getChildren();
    nestedDirectoryChildren.forEach((nested) => this._remove(path27, nested));
    const parent = this._getWatchedDir(directory);
    const wasTracked = parent.has(item);
    parent.remove(item);
    if (this._symlinkPaths.has(fullPath)) {
      this._symlinkPaths.delete(fullPath);
    }
    let relPath = path27;
    if (this.options.cwd)
      relPath = sp2.relative(this.options.cwd, path27);
    if (this.options.awaitWriteFinish && this._pendingWrites.has(relPath)) {
      const event = this._pendingWrites.get(relPath).cancelWait();
      if (event === EVENTS.ADD)
        return;
    }
    this._watched.delete(path27);
    this._watched.delete(fullPath);
    const eventName = isDirectory ? EVENTS.UNLINK_DIR : EVENTS.UNLINK;
    if (wasTracked && !this._isIgnored(path27))
      this._emit(eventName, path27);
    this._closePath(path27);
  }
  /**
   * Closes all watchers for a path
   */
  _closePath(path27) {
    this._closeFile(path27);
    const dir = sp2.dirname(path27);
    this._getWatchedDir(dir).remove(sp2.basename(path27));
  }
  /**
   * Closes only file-specific watchers
   */
  _closeFile(path27) {
    const closers = this._closers.get(path27);
    if (!closers)
      return;
    closers.forEach((closer) => closer());
    this._closers.delete(path27);
  }
  _addPathCloser(path27, closer) {
    if (!closer)
      return;
    let list = this._closers.get(path27);
    if (!list) {
      list = [];
      this._closers.set(path27, list);
    }
    list.push(closer);
  }
  _readdirp(root, opts) {
    if (this.closed)
      return;
    const options = { type: EVENTS.ALL, alwaysStat: true, lstat: true, ...opts, depth: 0 };
    let stream = readdirp(root, options);
    this._streams.add(stream);
    stream.once(STR_CLOSE, () => {
      stream = void 0;
    });
    stream.once(STR_END, () => {
      if (stream) {
        this._streams.delete(stream);
        stream = void 0;
      }
    });
    return stream;
  }
};
function watch(paths, options = {}) {
  const watcher = new FSWatcher(options);
  watcher.add(paths);
  return watcher;
}
var chokidar_default = { watch, FSWatcher };

// ../server/src/skill-store.ts
var SkillStore = class {
  workspace;
  cache = /* @__PURE__ */ new Map();
  fullCache = /* @__PURE__ */ new Map();
  watcher = null;
  constructor(workspace) {
    this.workspace = workspace;
  }
  async load() {
    this.cache.clear();
    this.fullCache.clear();
    const projectDir = await findExistingDir(this.workspace, ".minicodeide", "skills");
    const userDir = await findExistingDir(os3.homedir(), ".minicodeide", "skills");
    await this.scanDir(userDir, "user");
    await this.scanDir(projectDir, "project");
  }
  list() {
    return [...this.cache.values()].sort((a, b) => a.name.localeCompare(b.name));
  }
  get(name) {
    return this.cache.get(name);
  }
  /**
   * 启动文件监听，skills 目录变更时自动重新 load()。
   * 与 Agent Profile 的 _startProfileWatcher 设计对齐。
   */
  async startWatch() {
    if (this.watcher) return;
    const projectDir = await findExistingDir(this.workspace, ".minicodeide", "skills");
    const userDir = await findExistingDir(os3.homedir(), ".minicodeide", "skills");
    const dirs = [projectDir, userDir].filter((d) => d !== "");
    this.watcher = chokidar_default.watch(dirs, {
      ignoreInitial: true,
      depth: 2,
      // 只关心 SKILL.md 文件变化
      ignored: (p) => {
        const base = path19.basename(p);
        return base !== "SKILL.md" && !p.endsWith("/skills") && !dirs.some((d) => p === d);
      }
    });
    const reload = () => {
      this.load().catch((e) => console.warn("[skills] hot-reload failed:", e));
    };
    this.watcher.on("add", reload).on("change", reload).on("unlink", reload);
    console.log("[skills] watching for changes in", dirs.join(", "));
  }
  stopWatch() {
    this.watcher?.close();
    this.watcher = null;
  }
  /** 加载 skill 全文（懒加载 + 缓存） */
  async loadFull(name) {
    const cached = this.fullCache.get(name);
    if (cached) return cached;
    const meta = this.cache.get(name);
    if (!meta) return null;
    const raw = await fs19.readFile(meta.filePath, "utf-8").catch(() => "");
    const { body } = parseFrontmatter(raw);
    const supportFiles = await listSupportFiles(meta.directory).catch(() => []);
    const full = { ...meta, body, supportFiles };
    this.fullCache.set(name, full);
    return full;
  }
  /**
   * 根据用户输入匹配可能需要自动触发的 skill。
   * 匹配策略：用户输入中的 token 与 skill 的 triggers 列表做子串/全词匹配。
   * 返回匹配到的 skill meta 列表（按匹配数降序）。
   *
   * 使用场景：在 buildMessages() 中检测用户意图，自动加载匹配 skill 全文，
   * 而不是完全依赖 LLM 看到概览后主动调 use_skill。
   */
  matchForInput(input) {
    if (!input || !input.trim()) return [];
    const inputLower = input.toLowerCase();
    const inputTokens = tokenizeInput(inputLower);
    const matched = [];
    for (const meta of this.cache.values()) {
      if (!meta.triggers.length) continue;
      let score = 0;
      for (const trigger of meta.triggers) {
        const tLower = trigger.toLowerCase();
        if (inputLower.includes(tLower)) {
          score += tLower.length >= 3 ? 2 : 1;
          continue;
        }
        for (const token of inputTokens) {
          if (token === tLower || tLower.length >= 3 && token.includes(tLower)) {
            score += 1;
            break;
          }
        }
      }
      if (score > 0) {
        matched.push({ meta, score });
      }
    }
    return matched.sort((a, b) => b.score - a.score).map((m) => m.meta);
  }
  /**
   * 生成 system prompt 注入文本：仅概览（name + description），不含全文
   *
   * 设计：每条 skill 1 行，最多 30 行；超出截断告知 LLM 用 `/api/skills` 查更多
   */
  renderForSystem() {
    const all = this.list();
    if (all.length === 0) return "";
    const lines = ["# Available Skills (call `use_skill(name=...)` to load full instructions)"];
    const cap = 30;
    for (const s of all.slice(0, cap)) {
      const triggerHint = s.triggers.length > 0 ? ` (triggers: ${s.triggers.slice(0, 5).join(", ")})` : "";
      lines.push(`- **${s.name}** [${s.source}]: ${s.description.slice(0, 120)}${triggerHint}`);
    }
    if (all.length > cap) {
      lines.push(`- ... ${all.length - cap} more available; use \`use_skill\` with the exact name.`);
    }
    return lines.join("\n");
  }
  async scanDir(dir, source) {
    let entries = [];
    try {
      entries = await fs19.readdir(dir);
    } catch {
      return;
    }
    for (const name of entries) {
      const skillDir = path19.join(dir, name);
      let stat4;
      try {
        stat4 = await fs19.stat(skillDir);
      } catch {
        continue;
      }
      if (!stat4.isDirectory()) continue;
      const skillMd = path19.join(skillDir, "SKILL.md");
      let raw;
      try {
        raw = await fs19.readFile(skillMd, "utf-8");
      } catch {
        continue;
      }
      const { frontmatter } = parseFrontmatter(raw);
      const skillName = frontmatter.name ?? name;
      const description = frontmatter.description ?? "";
      const userInvocable = frontmatter.user_invocable !== false;
      let triggers = [];
      const rawTriggers = frontmatter.triggers;
      if (Array.isArray(rawTriggers)) {
        triggers = rawTriggers.map(String).filter((s) => s.length > 0);
      } else if (typeof rawTriggers === "string" && rawTriggers.length > 0) {
        triggers = rawTriggers.split(/[,，]\s*/).map((s) => s.trim()).filter((s) => s.length > 0);
      }
      const meta = {
        name: skillName,
        description,
        userInvocable,
        source,
        filePath: skillMd,
        directory: skillDir,
        triggers
      };
      this.cache.set(skillName, meta);
    }
  }
};
function parseFrontmatter(raw) {
  if (!raw.startsWith("---")) return { frontmatter: {}, body: raw };
  const end = raw.indexOf("\n---", 3);
  if (end < 0) return { frontmatter: {}, body: raw };
  const headerBlock = raw.slice(3, end).trim();
  const body = raw.slice(end + 4).replace(/^\n/, "");
  const fm = {};
  for (const line of headerBlock.split("\n")) {
    const m = line.match(/^([\w-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    let value = m[2].trim();
    if (typeof value === "string" && /^\[.*\]$/.test(value)) {
      const inner = value.slice(1, -1);
      value = inner.split(/,\s*/).map((s) => s.trim().replace(/^["']|["']$/g, "")).filter((s) => s.length > 0);
    } else {
      if (value === "true") value = true;
      else if (value === "false") value = false;
      else if (typeof value === "string" && /^-?\d+$/.test(value)) value = Number(value);
      if (typeof value === "string" && /^["'].*["']$/.test(value)) value = value.slice(1, -1);
    }
    fm[m[1]] = value;
  }
  return { frontmatter: fm, body };
}
function tokenizeInput(s) {
  const out = [];
  for (const m of s.matchAll(/[a-z0-9_]{2,}/g)) out.push(m[0]);
  const cjk = [...s].filter((c) => /[\u4e00-\u9fff]/.test(c));
  for (let i = 0; i < cjk.length; i++) {
    out.push(cjk[i]);
    if (i + 1 < cjk.length) out.push(cjk[i] + cjk[i + 1]);
  }
  return out;
}
async function listSupportFiles(dir) {
  const out = [];
  const walk2 = async (cur, rel) => {
    const entries = await fs19.readdir(cur, { withFileTypes: true }).catch(() => []);
    for (const e of entries) {
      const child = path19.join(cur, e.name);
      const childRel = rel ? `${rel}/${e.name}` : e.name;
      if (e.isDirectory()) {
        if (e.name.startsWith(".") || e.name === "node_modules") continue;
        await walk2(child, childRel);
      } else if (e.isFile() && e.name !== "SKILL.md") {
        out.push(childRel);
      }
    }
  };
  await walk2(dir, "");
  return out.slice(0, 100);
}
async function findExistingDir(parent, dirName, subDir) {
  const exact = path19.join(parent, dirName, subDir);
  try {
    const stat4 = await fs19.stat(exact);
    if (stat4.isDirectory()) return exact;
  } catch {
  }
  try {
    const entries = await fs19.readdir(parent, { withFileTypes: true });
    const matched = entries.find(
      (e) => e.isDirectory() && e.name.toLowerCase() === dirName.toLowerCase() && e.name !== dirName
    );
    if (matched) {
      const alt = path19.join(parent, matched.name, subDir);
      try {
        const stat4 = await fs19.stat(alt);
        if (stat4.isDirectory()) return alt;
      } catch {
      }
    }
  } catch {
  }
  return exact;
}

// ../server/src/subagent-manager.ts
import { EventEmitter as EventEmitter2 } from "node:events";
import * as fsSync from "node:fs";
import path20 from "node:path";
var TypedEmitter = class {
  ee = new EventEmitter2();
  on(ev, fn) {
    this.ee.on(ev, fn);
    return this;
  }
  off(ev, fn) {
    this.ee.off(ev, fn);
    return this;
  }
  emit(ev, payload) {
    this.ee.emit(ev, payload);
  }
};
var SubagentManager = class extends TypedEmitter {
  opts;
  runs = /* @__PURE__ */ new Map();
  /** parentSessionId → active runIds（用于并发限制 + announce 路由） */
  byParent = /* @__PURE__ */ new Map();
  /** runId 幂等：已经 announce 过的不再二次推送 */
  announced = /* @__PURE__ */ new Set();
  /** 已推送但还没被父 turn 消费的 announce message（父端 follow-up turn 拉取） */
  pendingAnnounceByParent = /* @__PURE__ */ new Map();
  /** 角色 profile 缓存（启动时加载一次，文件变更时可手动 refresh） */
  profiles = /* @__PURE__ */ new Map();
  /** fs.watch watcher instance（hot-reload 用） */
  profileWatcher = null;
  /** debounce timer for hot-reload */
  profileReloadTimer = null;
  /** 等待某个 parent 当前所有 active subagent 完成（或 timeout）。父 turn 末尾用 */
  async awaitAllForParent(parentSessionId, timeoutMs = 6e4) {
    const active = this.byParent.get(parentSessionId);
    if (!active || active.size === 0) return;
    const deadline = Date.now() + timeoutMs;
    await new Promise((resolve3) => {
      const tick = () => {
        const cur = this.byParent.get(parentSessionId);
        if (!cur || cur.size === 0) return resolve3();
        if (Date.now() >= deadline) return resolve3();
        setTimeout(tick, 100);
      };
      tick();
    });
  }
  constructor(opts) {
    super();
    this.opts = {
      maxDepth: 2,
      maxConcurrentPerParent: 3,
      runTimeoutMs: 12e4,
      ...opts
    };
    loadAgentProfiles(opts.workspaceRoot).then((map) => {
      this.profiles = map;
      if (map.size > 0) {
        console.log(`[subagents] Loaded ${map.size} agent profiles: ${[...map.keys()].join(", ")}`);
      }
    }).catch(() => void 0);
    this._startProfileWatcher(opts.workspaceRoot);
  }
  /** 手动刷新 profile（用户编辑 .minicodeide/agents/ 后调用） */
  async refreshProfiles() {
    this.profiles = await loadAgentProfiles(this.opts.workspaceRoot);
    return this.profiles.size;
  }
  /** 返回当前所有 profile 名（用于 tool description 动态填充） */
  getProfileNames() {
    return [...this.profiles.values()].map((p) => ({ name: p.name, description: p.description }));
  }
  /**
   * 父 Agent 调 dispatch_subagent 时进入这里。
   * 立刻返回 runId（不阻塞父 turn），后台跑 runAgent。
   */
  async spawn(spec) {
    const childDepth = spec.parentDepth + 1;
    if (childDepth > this.opts.maxDepth) {
      throw new Error(`Subagent depth limit (${this.opts.maxDepth}) reached`);
    }
    const activeForParent = this.byParent.get(spec.parentSessionId)?.size ?? 0;
    if (activeForParent >= this.opts.maxConcurrentPerParent) {
      throw new Error(
        `Max concurrent subagents per parent (${this.opts.maxConcurrentPerParent}) reached`
      );
    }
    const child = await this.opts.sessions.create(
      `[subagent] ${spec.label ?? spec.task.slice(0, 40)}`
    );
    const runId = `srun_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
    const run2 = {
      runId,
      childSessionId: child.id,
      parentSessionId: spec.parentSessionId,
      label: spec.label ?? "(no-label)",
      task: spec.task,
      role: spec.role,
      status: "running",
      startedAt: Date.now(),
      depth: childDepth
    };
    this.runs.set(runId, run2);
    if (!this.byParent.has(spec.parentSessionId)) this.byParent.set(spec.parentSessionId, /* @__PURE__ */ new Set());
    this.byParent.get(spec.parentSessionId).add(runId);
    void this.runChild(run2);
    return { runId, childSessionId: child.id };
  }
  /** 父端在新 turn 启动前拉取累积的 announce，作为合成 user 消息合入 */
  pickPendingAnnouncements(parentSessionId) {
    const buf = this.pendingAnnounceByParent.get(parentSessionId);
    if (!buf || buf.length === 0) return [];
    this.pendingAnnounceByParent.delete(parentSessionId);
    return buf;
  }
  hasPending(parentSessionId) {
    return (this.pendingAnnounceByParent.get(parentSessionId)?.length ?? 0) > 0;
  }
  list(parentSessionId) {
    const all = [...this.runs.values()];
    if (parentSessionId) return all.filter((r) => r.parentSessionId === parentSessionId);
    return all;
  }
  async runChild(run2) {
    const profile = run2.role ? getProfile(this.profiles, run2.role) : void 0;
    const systemLines = [];
    if (profile) {
      systemLines.push(
        `[Subagent Role: ${profile.name}]`,
        profile.systemPrompt,
        "",
        `[Subagent Context]`,
        `You are running as a subagent (depth ${run2.depth}/${this.opts.maxDepth}) with role "${profile.name}".`,
        `Role description: ${profile.description}`,
        'Your output will be auto-delivered to the requester as a single "[Subagent Completed]" message.'
      );
      if (profile.sandbox === "read_only") {
        systemLines.push("", "[Sandbox: read_only]", "You CANNOT write files. Your job is to read, analyze, and report findings.");
      }
    } else {
      systemLines.push(
        "[Subagent Context]",
        `You are running as a subagent (depth ${run2.depth}/${this.opts.maxDepth}).`,
        'Your output will be auto-delivered to the requester as a single "[Subagent Completed]" message.'
      );
    }
    systemLines.push(
      "",
      "[Rules]",
      "- You CANNOT spawn further subagents (dispatch_subagent is disabled here).",
      "- You CANNOT modify the parent plan (update_plan is disabled here).",
      "- Be concise. Produce a final answer in 1 turn if possible; max 8 steps.",
      "- Do not poll status of other agents. You have no visibility into siblings.",
      "",
      `[Subagent Task]: ${run2.task}`
    );
    const SUBAGENT_SYSTEM = systemLines.join("\n");
    const childRegistry = this.buildChildRegistry(profile);
    const messages = [
      { role: "system", content: SUBAGENT_SYSTEM },
      { role: "user", content: run2.task }
    ];
    const abort = new AbortController();
    const timeoutHandle = setTimeout(() => abort.abort(), this.opts.runTimeoutMs);
    let childTurnId;
    try {
      childTurnId = await this.opts.sessions.startTurn(run2.childSessionId, run2.task).catch(() => void 0);
      await this.opts.sessions.append(run2.childSessionId, { role: "user", content: run2.task });
      const childCtx = {
        ...this.opts.childToolCtxFactory(),
        subagentDepth: run2.depth
        // 即使子 registry 没有 dispatch tool，也带上 depth 信息
      };
      let isolatedPath;
      if (this.opts.worktrees) {
        try {
          const wt = await this.opts.worktrees.createForSubagent(run2.runId);
          if (wt.isolated) {
            isolatedPath = wt.path;
            childCtx.cwd = wt.path;
          }
        } catch {
        }
      }
      let assistantBuf = "";
      const resolvedLlm = typeof this.opts.llm === "function" ? this.opts.llm() : this.opts.llm;
      const resolvedModel = typeof this.opts.defaultModel === "function" ? this.opts.defaultModel() : this.opts.defaultModel;
      for await (const ev of runAgent({
        llm: resolvedLlm,
        registry: childRegistry,
        messages,
        toolCtx: childCtx,
        signal: abort.signal,
        maxSteps: 8,
        model: resolvedModel
      })) {
        if (ev.type === "text" && ev.text) {
          assistantBuf += ev.text;
          if (childTurnId) {
            this.opts.sessions.appendChunk(run2.childSessionId, childTurnId, ev.text).catch(() => void 0);
          }
          this.emit("child_text", { runId: run2.runId, text: ev.text });
        }
        if (ev.type === "tool_call" && ev.toolCall) {
          this.emit("child_tool", { runId: run2.runId, tool: ev.toolCall.name });
          if (childTurnId) {
            this.opts.sessions.appendTool(run2.childSessionId, childTurnId, {
              name: ev.toolCall.name,
              args: ev.toolCall.arguments
            }).catch(() => void 0);
          }
        }
        if (ev.type === "tool_result") {
          const preview = typeof ev.toolResult === "string" ? ev.toolResult.slice(0, 80).replace(/\n/g, " ") : "";
          this.emit("child_tool_result", {
            runId: run2.runId,
            tool: ev.toolCall?.name ?? "unknown",
            resultPreview: preview
          });
        }
        if (ev.type === "error") {
          throw new Error(ev.error ?? "subagent error");
        }
      }
      const finalText = assistantBuf.trim();
      run2.result = finalText;
      run2.status = "completed";
      if (childTurnId) {
        await this.opts.sessions.endTurn(run2.childSessionId, childTurnId, finalText).catch(() => void 0);
      }
    } catch (e) {
      const isTimeout = abort.signal.aborted;
      run2.status = isTimeout ? "timeout" : "error";
      run2.error = e?.message ?? String(e);
      if (childTurnId) {
        await this.opts.sessions.interruptTurn(run2.childSessionId, childTurnId, run2.error).catch(() => void 0);
      }
    } finally {
      clearTimeout(timeoutHandle);
      run2.finishedAt = Date.now();
      this.byParent.get(run2.parentSessionId)?.delete(run2.runId);
      this.deliverAnnounce(run2);
      if (this.opts.worktrees) {
        this.opts.worktrees.remove(run2.runId, { keepBranch: true }).catch(() => void 0);
      }
    }
  }
  /** 把 run 结果构建 announce message 并放入父的 pending 队列（zero-token，user 角色注入） */
  deliverAnnounce(run2) {
    if (this.announced.has(run2.runId)) return;
    this.announced.add(run2.runId);
    const lines = [];
    lines.push(`[Subagent Completed] runId=${run2.runId} label=${run2.label} outcome=${run2.status}`);
    if (run2.status === "completed") {
      lines.push("---");
      lines.push(run2.result ?? "(empty)");
    } else {
      lines.push(`error: ${run2.error ?? "(unknown)"}`);
    }
    const msg = lines.join("\n");
    if (!this.pendingAnnounceByParent.has(run2.parentSessionId)) {
      this.pendingAnnounceByParent.set(run2.parentSessionId, []);
    }
    this.pendingAnnounceByParent.get(run2.parentSessionId).push(msg);
    this.emit("announce", { run: run2 });
  }
  /** 子 Agent 的 registry：拿全 builtin，然后剔除危险/不该有的；profile 可进一步裁剪 */
  buildChildRegistry(profile) {
    const r = new ToolRegistry();
    registerBuiltinTools(r);
    r.unregister("dispatch_subagent");
    r.unregister("update_plan");
    if (profile) {
      if (profile.allowedTools && profile.allowedTools.length > 0) {
        const allNames = r.list().map((t) => t.name);
        for (const name of allNames) {
          if (!profile.allowedTools.includes(name)) {
            r.unregister(name);
          }
        }
      } else if (profile.deniedTools && profile.deniedTools.length > 0) {
        for (const name of profile.deniedTools) {
          r.unregister(name);
        }
      }
      if (profile.sandbox === "read_only") {
        r.unregister("write_file");
        r.unregister("edit_file");
        r.unregister("run_command");
      }
    } else {
      r.unregister("write_file");
      r.unregister("edit_file");
      r.unregister("run_command");
    }
    return r;
  }
  // --- P3-D5: Agent Profile hot-reload ---
  /**
   * 启动 fs.watch 监听 .minicodeide/agents/ 目录变更。
   * 文件增/删/改 → debounce 500ms → 自动 refreshProfiles。
   * 无 agents 目录或 fs.watch 不可用 → 静默跳过。
   */
  _startProfileWatcher(workspaceRoot) {
    const agentsDir = path20.join(workspaceRoot, ".minicodeide", "agents");
    try {
      const stat4 = fsSync.statSync(agentsDir);
      if (!stat4.isDirectory()) return;
    } catch {
      return;
    }
    try {
      this.profileWatcher = fsSync.watch(agentsDir, (eventType, filename) => {
        if (!filename || !filename.endsWith(".md")) return;
        if (this.profileReloadTimer) clearTimeout(this.profileReloadTimer);
        this.profileReloadTimer = setTimeout(async () => {
          try {
            const count = await this.refreshProfiles();
            console.log(`[subagents] Hot-reloaded ${count} agent profiles (trigger: ${eventType} ${filename})`);
          } catch (e) {
            console.error(`[subagents] Hot-reload failed: ${e?.message ?? e}`);
          }
        }, 500);
      });
      console.log(`[subagents] Watching ${agentsDir} for profile hot-reload`);
    } catch (e) {
      console.warn(`[subagents] fs.watch on ${agentsDir} failed: ${e?.message ?? e}. Profiles will NOT auto-reload.`);
    }
  }
  /** 停止 profile watcher（server shutdown 时调用） */
  stopProfileWatcher() {
    if (this.profileWatcher) {
      this.profileWatcher.close();
      this.profileWatcher = null;
    }
    if (this.profileReloadTimer) {
      clearTimeout(this.profileReloadTimer);
      this.profileReloadTimer = null;
    }
  }
};

// ../server/src/mcp-client.ts
import { spawn } from "node:child_process";
import * as fs20 from "node:fs";
import * as path21 from "node:path";
var DEFAULT_ALLOWLIST = {
  allowedCommands: ["npx", "uvx", "node", "python3", "python", "bunx", "pnpm", "docker"],
  denyArgs: ["--allow-shell", "--unsafe", "--rm-rf"]
};
function loadAllowlist(workspace) {
  const f = path21.join(workspace, ".minicodeide", "mcp-allowlist.json");
  if (!fs20.existsSync(f)) return DEFAULT_ALLOWLIST;
  try {
    const raw = JSON.parse(fs20.readFileSync(f, "utf8"));
    return {
      allowedCommands: raw.allowedCommands ?? DEFAULT_ALLOWLIST.allowedCommands,
      denyArgs: raw.denyArgs ?? DEFAULT_ALLOWLIST.denyArgs
    };
  } catch {
    return DEFAULT_ALLOWLIST;
  }
}
function validateServerAgainstAllowlist(cfg, allow) {
  const base = path21.basename(cfg.command).toLowerCase();
  if (!allow.allowedCommands.map((c) => c.toLowerCase()).includes(base)) {
    return `command "${cfg.command}" not in allowedCommands. Add it to .minicodeide/mcp-allowlist.json`;
  }
  const argsLower = (cfg.args ?? []).map((a) => String(a).toLowerCase());
  for (const deny of allow.denyArgs ?? []) {
    const dl = deny.toLowerCase();
    if (argsLower.some((a) => a.includes(dl))) {
      return `args contain forbidden token "${deny}"`;
    }
  }
  return null;
}
var McpClient = class {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }
  name;
  config;
  proc = null;
  nextId = 1;
  pending = /* @__PURE__ */ new Map();
  buf = "";
  readyPromise = null;
  tools = [];
  connected = false;
  /** P2 修复：自动重连状态 */
  reconnectAttempts = 0;
  MAX_RECONNECT = 3;
  reconnectTimer = null;
  /** 重连成功/失败回调（McpManager 用于更新工具注册和通知前端） */
  onReconnect;
  async connect() {
    if (this.readyPromise) return this.readyPromise;
    this.readyPromise = (async () => {
      const proc = spawn(this.config.command, this.config.args ?? [], {
        env: { ...process.env, ...this.config.env ?? {} },
        stdio: ["pipe", "pipe", "pipe"]
      });
      this.proc = proc;
      proc.stdout.setEncoding("utf8");
      proc.stdout.on("data", (chunk) => this.onStdout(chunk));
      proc.stderr.on("data", (c) => {
      });
      proc.on("exit", (code) => {
        this.connected = false;
        for (const [, p] of this.pending) {
          p.reject(new Error(`MCP server "${this.name}" exited (code=${code})`));
        }
        this.pending.clear();
        if (code !== 0 && this.reconnectAttempts < this.MAX_RECONNECT) {
          this.scheduleReconnect();
        }
      });
      proc.on("error", (e) => {
        for (const [, p] of this.pending) p.reject(e);
        this.pending.clear();
      });
      await this.request("initialize", {
        protocolVersion: "2024-11-05",
        capabilities: {},
        clientInfo: { name: "minicodeide", version: "0.1" }
      });
      this.notify("notifications/initialized", {});
      const r = await this.request("tools/list", {});
      this.tools = r?.tools ?? [];
      if (this.config.disabledTools?.length) {
        const disabled = new Set(this.config.disabledTools);
        this.tools = this.tools.filter((t) => !disabled.has(t.name));
      }
      this.connected = true;
      this.reconnectAttempts = 0;
    })();
    return this.readyPromise;
  }
  async callTool(name, args) {
    if (!this.connected) await this.connect();
    const r = await this.request("tools/call", { name, arguments: args ?? {} });
    return r;
  }
  async close() {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.reconnectAttempts = this.MAX_RECONNECT;
    if (this.proc) {
      try {
        this.proc.kill("SIGTERM");
      } catch {
      }
      this.proc = null;
    }
    this.connected = false;
  }
  /**
   * P2 修复：指数退避自动重连。
   * 延迟 = 1s * 2^attempt（1s → 2s → 4s），最多 MAX_RECONNECT 次。
   */
  scheduleReconnect() {
    const attempt = this.reconnectAttempts + 1;
    const delay = 1e3 * Math.pow(2, attempt - 1);
    console.log(`[mcp:${this.name}] Scheduling reconnect attempt ${attempt}/${this.MAX_RECONNECT} in ${delay}ms`);
    this.reconnectTimer = setTimeout(async () => {
      this.reconnectAttempts = attempt;
      this.readyPromise = null;
      try {
        await this.connect();
        console.log(`[mcp:${this.name}] Reconnected successfully (attempt ${attempt})`);
        this.onReconnect?.(true, attempt);
      } catch (e) {
        console.warn(`[mcp:${this.name}] Reconnect failed (attempt ${attempt}): ${e?.message ?? e}`);
        this.onReconnect?.(false, attempt, e?.message ?? String(e));
      }
    }, delay);
  }
  request(method, params) {
    const id = this.nextId++;
    const req = { jsonrpc: "2.0", id, method, params };
    return new Promise((resolve3, reject) => {
      const timer = setTimeout(() => {
        this.pending.delete(id);
        reject(new Error(`MCP request "${method}" timeout (30s)`));
      }, 3e4);
      this.pending.set(id, {
        resolve: (v) => {
          clearTimeout(timer);
          resolve3(v);
        },
        reject: (e) => {
          clearTimeout(timer);
          reject(e);
        }
      });
      this.proc.stdin.write(JSON.stringify(req) + "\n");
    });
  }
  notify(method, params) {
    const req = { jsonrpc: "2.0", method, params };
    try {
      this.proc.stdin.write(JSON.stringify(req) + "\n");
    } catch {
    }
  }
  onStdout(chunk) {
    this.buf += chunk;
    let nl;
    while ((nl = this.buf.indexOf("\n")) >= 0) {
      const line = this.buf.slice(0, nl).trim();
      this.buf = this.buf.slice(nl + 1);
      if (!line) continue;
      try {
        const msg = JSON.parse(line);
        if (typeof msg.id === "number" && this.pending.has(msg.id)) {
          const p = this.pending.get(msg.id);
          this.pending.delete(msg.id);
          if (msg.error) p.reject(new Error(`${msg.error.code}: ${msg.error.message}`));
          else p.resolve(msg.result);
        }
      } catch {
      }
    }
  }
};
var McpManager = class {
  constructor(workspace) {
    this.workspace = workspace;
  }
  workspace;
  clients = /* @__PURE__ */ new Map();
  async loadAndConnect() {
    const cfgPath = path21.join(this.workspace, ".minicodeide", "mcp.json");
    if (!fs20.existsSync(cfgPath)) return [];
    let cfg;
    try {
      cfg = JSON.parse(fs20.readFileSync(cfgPath, "utf8"));
    } catch (e) {
      return [{ name: "<config>", ok: false, error: `mcp.json parse error: ${e?.message ?? e}` }];
    }
    const allow = loadAllowlist(this.workspace);
    const out = [];
    for (const [name, sc] of Object.entries(cfg.servers ?? {})) {
      const reject = validateServerAgainstAllowlist(sc, allow);
      if (reject) {
        out.push({ name, ok: false, error: `denied by allowlist: ${reject}` });
        continue;
      }
      const client = new McpClient(name, sc);
      try {
        await client.connect();
        this.clients.set(name, client);
        out.push({ name, ok: true, toolCount: client.tools.length });
      } catch (e) {
        out.push({ name, ok: false, error: e?.message ?? String(e) });
      }
    }
    return out;
  }
  list() {
    return [...this.clients.values()];
  }
  get(name) {
    return this.clients.get(name);
  }
  async closeAll() {
    for (const c of this.clients.values()) await c.close();
    this.clients.clear();
  }
  /**
   * 把所有已连接的 MCP tools 注册到 ToolRegistry。
   * 命名：mcp__<server>__<tool>
   *
   * 修复（P1）：将 MCP inputSchema（JSON Schema）转换为 zod schema，
   * 使 LLM 能通过 tool parameters 字段获得结构化的参数信息，
   * 而非之前的 z.record(z.string(), z.any()) 万能占位。
   */
  registerToolsTo(registry) {
    for (const client of this.clients.values()) {
      for (const tool of client.tools) {
        const fqName = `mcp__${client.name}__${tool.name}`;
        const desc = (tool.description ?? "").slice(0, 1e3) || `MCP tool ${tool.name} from "${client.name}".`;
        let zodSchema;
        try {
          zodSchema = tool.inputSchema ? jsonSchemaToZod(tool.inputSchema) : external_exports.record(external_exports.string(), external_exports.any());
        } catch {
          zodSchema = external_exports.record(external_exports.string(), external_exports.any());
        }
        const t = {
          name: fqName,
          description: `[MCP:${client.name}] ${desc}`.slice(0, 4e3),
          schema: zodSchema,
          parallelSafe: false,
          // 保守：未知副作用 → 串行
          async execute(input) {
            const r = await client.callTool(tool.name, input);
            if (r?.content && Array.isArray(r.content)) {
              const text = r.content.map((c) => {
                if (c?.type === "text") return c.text;
                if (c?.type === "image") return `[image ${c.mimeType}]`;
                if (c?.type === "resource") return `[resource ${c.resource?.uri}]`;
                return JSON.stringify(c);
              }).join("\n");
              return { ok: !r.isError, content: text, raw: r };
            }
            return r;
          }
        };
        registry.register(t);
      }
    }
  }
};
function jsonSchemaToZod(schema) {
  if (!schema || typeof schema !== "object") return external_exports.any();
  const type = schema.type;
  if (schema.anyOf || schema.oneOf) {
    const variants = schema.anyOf || schema.oneOf;
    if (variants.length === 1) return jsonSchemaToZod(variants[0]);
    if (variants.length === 2 && variants.some((v) => v.type === "null")) {
      const nonNull = variants.find((v) => v.type !== "null");
      if (nonNull) return jsonSchemaToZod(nonNull).nullable();
    }
    return external_exports.any();
  }
  if (schema.enum) {
    const values = schema.enum.filter((v) => v !== null);
    if (values.length > 0 && values.every((v) => typeof v === "string")) {
      const [first, ...rest] = values;
      let zodEnum = external_exports.enum([first, ...rest]);
      if (schema.enum.includes(null)) zodEnum = zodEnum.nullable();
      return zodEnum;
    }
    return external_exports.any();
  }
  switch (type) {
    case "object": {
      const properties = schema.properties ?? {};
      const required = new Set(schema.required ?? []);
      const shape = {};
      for (const [key, propSchema] of Object.entries(properties)) {
        let fieldSchema = jsonSchemaToZod(propSchema);
        if (propSchema?.description) {
          fieldSchema = fieldSchema.describe(propSchema.description);
        }
        if (!required.has(key)) {
          shape[key] = fieldSchema.optional();
        } else {
          shape[key] = fieldSchema;
        }
      }
      let obj = external_exports.object(shape);
      if (schema.additionalProperties === false) {
        obj = obj.strict();
      }
      if (Object.keys(properties).length === 0 && schema.additionalProperties && typeof schema.additionalProperties === "object") {
        return external_exports.record(external_exports.string(), jsonSchemaToZod(schema.additionalProperties));
      }
      return obj;
    }
    case "array": {
      if (schema.items) {
        return external_exports.array(jsonSchemaToZod(schema.items));
      }
      return external_exports.array(external_exports.any());
    }
    case "string":
      return external_exports.string();
    case "number":
    case "integer":
      return external_exports.number();
    case "boolean":
      return external_exports.boolean();
    case "null":
      return external_exports.null();
    default:
      return external_exports.any();
  }
}

// ../server/src/key-rotator.ts
var AllKeysCooldownError = class extends Error {
  constructor(profileId, nextAvailableInMs) {
    super(
      `[KeyRotator] all keys for profile '${profileId}' are in cooldown; next slot available in ${Math.ceil(
        nextAvailableInMs / 1e3
      )}s`
    );
    this.profileId = profileId;
    this.nextAvailableInMs = nextAvailableInMs;
  }
  profileId;
  nextAvailableInMs;
};
var KeyRotator = class {
  constructor(profileId, keys) {
    this.profileId = profileId;
    if (keys.length === 0) throw new Error("KeyRotator: at least 1 key required");
    this.keys = keys.map((k) => ({ key: k, cooldownUntil: 0, successCount: 0, failCount: 0 }));
  }
  profileId;
  keys;
  cursor = 0;
  /**
   * 拿一个可用 key。round-robin。
   * 全在冷却 → 抛 AllKeysCooldownError。
   */
  pick() {
    const now = Date.now();
    for (let i = 0; i < this.keys.length; i++) {
      const idx = (this.cursor + i) % this.keys.length;
      const s = this.keys[idx];
      if (s.cooldownUntil <= now) {
        this.cursor = (idx + 1) % this.keys.length;
        return s;
      }
    }
    const nextAt = Math.min(...this.keys.map((k) => k.cooldownUntil));
    throw new AllKeysCooldownError(this.profileId, Math.max(0, nextAt - now));
  }
  markSuccess(key) {
    const s = this.keys.find((x) => x.key === key);
    if (s) {
      s.successCount++;
      s.cooldownUntil = 0;
    }
  }
  markFailure(key, errKind) {
    const s = this.keys.find((x) => x.key === key);
    if (!s) return;
    s.failCount++;
    const now = Date.now();
    let cd = 0;
    switch (errKind) {
      case "http_429":
        cd = 6e4;
        break;
      case "http_401":
        cd = 5 * 6e4;
        break;
      case "http_5xx":
        cd = 1e4;
        break;
      case "timeout":
      case "network":
        cd = 5e3;
        break;
      default:
        cd = 3e3;
    }
    s.cooldownUntil = now + cd;
  }
  /** 调试 / metrics */
  stats() {
    const now = Date.now();
    return this.keys.map((k) => ({
      keyTail: k.key.slice(-6),
      cooldownMs: Math.max(0, k.cooldownUntil - now),
      success: k.successCount,
      fail: k.failCount
    }));
  }
  size() {
    return this.keys.length;
  }
};
var rotators = /* @__PURE__ */ new Map();
function getOrCreateRotator(profileId, keys) {
  const sig = profileId + ":" + keys.length + ":" + keys.map((k) => k.slice(-4)).join(",");
  const cached = rotators.get(profileId);
  if (cached && cached.__sig === sig) return cached;
  const r = new KeyRotator(profileId, keys);
  r.__sig = sig;
  rotators.set(profileId, r);
  return r;
}

// ../server/src/llm-router.ts
var MAX_FAILURES = 3;
var COOLDOWN_MS = 3e4;
var CircuitBreaker = class {
  health = /* @__PURE__ */ new Map();
  getOrCreate(profileId) {
    if (!this.health.has(profileId)) {
      this.health.set(profileId, { state: "closed", consecutiveFailures: 0, lastFailureAt: 0 });
    }
    return this.health.get(profileId);
  }
  /** 判断某个 profile 当前是否可以接受请求 */
  isAvailable(profileId) {
    const h = this.getOrCreate(profileId);
    if (h.state === "closed") return true;
    if (h.state === "half-open") return true;
    if (Date.now() - h.lastFailureAt >= COOLDOWN_MS) {
      h.state = "half-open";
      return true;
    }
    return false;
  }
  /** 请求成功：重置状态 */
  markSuccess(profileId) {
    const h = this.getOrCreate(profileId);
    h.state = "closed";
    h.consecutiveFailures = 0;
  }
  /** 请求失败：累加计数，必要时触发熔断 */
  markFailure(profileId) {
    const h = this.getOrCreate(profileId);
    h.consecutiveFailures++;
    h.lastFailureAt = Date.now();
    if (h.consecutiveFailures >= MAX_FAILURES) {
      h.state = "open";
    }
  }
  /** 获取某个 profile 的当前状态（调试/监控用） */
  getState(profileId) {
    const h = this.getOrCreate(profileId);
    if (h.state === "open" && Date.now() - h.lastFailureAt >= COOLDOWN_MS) {
      h.state = "half-open";
    }
    return h.state;
  }
};
var LLMRouter = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  name = "router";
  /** P1 修复：Circuit Breaker 实例，追踪每个 profile 的健康状态 */
  circuitBreaker = new CircuitBreaker();
  async *chatStream(messages, opts = {}) {
    if (this.opts.profiles.length === 0) {
      throw new Error("LLMRouter: no profiles configured");
    }
    let lastErr = null;
    for (let i = 0; i < this.opts.profiles.length; i++) {
      const profile = this.opts.profiles[i];
      if (!this.circuitBreaker.isAvailable(profile.id)) {
        const next = this.opts.profiles[i + 1];
        if (next) {
          this.opts.onSwitch?.({
            fromProfileId: profile.id,
            toProfileId: next.id,
            error: `circuit breaker open (${this.circuitBreaker.getState(profile.id)})`,
            errorKind: "unknown"
          });
          continue;
        }
      }
      const keys = profile.apiKeys && profile.apiKeys.length > 0 ? profile.apiKeys : [profile.apiKey];
      const rotator = getOrCreateRotator(profile.id, keys);
      const innerMaxTries = keys.length;
      let keyChosen = null;
      let providerStarted = false;
      for (let attempt = 0; attempt < innerMaxTries; attempt++) {
        let keyState;
        try {
          keyState = rotator.pick();
        } catch (e) {
          lastErr = e;
          break;
        }
        keyChosen = keyState.key;
        const provider = createProvider({ ...profile, apiKey: keyChosen });
        const model = opts.model ?? profile.model;
        let started = false;
        try {
          const stream = provider.chatStream(messages, { ...opts, model });
          for await (const chunk of stream) {
            if (!started) started = true;
            providerStarted = true;
            yield chunk;
          }
          rotator.markSuccess(keyChosen);
          this.circuitBreaker.markSuccess(profile.id);
          return;
        } catch (e) {
          lastErr = e;
          const kind = classifyError2(e);
          rotator.markFailure(keyChosen, kind === "unknown" ? "unknown" : kind);
          if (started) {
            throw e;
          }
          const retryableInner = kind === "http_429" || kind === "http_5xx" || kind === "timeout" || kind === "network";
          if (retryableInner && attempt + 1 < innerMaxTries) {
            continue;
          }
          this.circuitBreaker.markFailure(profile.id);
          break;
        }
      }
      if (providerStarted) return;
      const nextProfile = this.opts.profiles[i + 1];
      if (nextProfile) {
        const kind = classifyError2(lastErr);
        this.opts.onSwitch?.({
          fromProfileId: profile.id,
          toProfileId: nextProfile.id,
          error: stringifyError(lastErr),
          errorKind: kind
        });
        continue;
      }
      throw lastErr ?? new Error(`LLMRouter: profile '${profile.id}' exhausted, no fallback`);
    }
    throw lastErr ?? new Error("LLMRouter: no providers succeeded");
  }
  async embed(texts) {
    let lastErr = null;
    for (let i = 0; i < this.opts.profiles.length; i++) {
      const profile = this.opts.profiles[i];
      const provider = createProvider(profile);
      if (!provider.embed) {
        lastErr = new Error(`provider ${profile.id} (${profile.kind ?? "auto"}) has no embed()`);
        continue;
      }
      try {
        return await provider.embed(texts);
      } catch (e) {
        lastErr = e;
        const next = this.opts.profiles[i + 1];
        if (next) {
          this.opts.onSwitch?.({
            fromProfileId: profile.id,
            toProfileId: next.id,
            error: stringifyError(e),
            errorKind: classifyError2(e)
          });
          continue;
        }
        throw e;
      }
    }
    throw lastErr ?? new Error("LLMRouter.embed: no providers succeeded");
  }
};
function createProvider(profile) {
  const kind = profile.kind ?? (isAnthropicEndpoint(profile.baseUrl) ? "anthropic" : "openai");
  if (kind === "anthropic") {
    return new AnthropicProvider({
      baseURL: profile.baseUrl || "https://api.anthropic.com",
      apiKey: profile.apiKey,
      defaultModel: profile.model || "claude-3-5-sonnet-20241022",
      enableCacheControl: true
    });
  }
  return new OpenAICompatProvider({
    baseURL: profile.baseUrl || "https://api.deepseek.com/v1",
    apiKey: profile.apiKey || "sk-mock",
    defaultModel: profile.model || "deepseek-chat",
    embedModel: profile.embedModel || "text-embedding-3-small",
    // 走 OpenAI 兼容代理调 Claude 也支持 cache_control
    enableAnthropicCache: /claude|anthropic/i.test(profile.model ?? ""),
    // 多模态 vision 支持：默认 true；用户可在 profile 里设为 false
    supportsVision: profile.supportsVision !== false
  });
}
function classifyError2(e) {
  const s = stringifyError(e);
  if (/HTTP 401|unauthorized|invalid.?api.?key/i.test(s)) return "unknown";
  if (/HTTP 429/.test(s) || /rate.?limit/i.test(s)) return "http_429";
  if (/HTTP 5\d\d/.test(s)) return "http_5xx";
  if (/timeout|ETIMEDOUT|ESOCKETTIMEDOUT/i.test(s)) return "timeout";
  if (/ECONNREFUSED|ENOTFOUND|ECONNRESET|fetch failed|network/i.test(s)) return "network";
  return "unknown";
}
function stringifyError(e) {
  if (!e) return "";
  if (typeof e === "string") return e;
  const any = e;
  return any?.message ?? String(e);
}

// ../server/src/reranker.ts
var IdentityReranker = class {
  name = "identity";
  async rerank(_q, cs, topN) {
    return cs.slice(0, topN ?? cs.length).map((c, i) => ({
      candidate: c,
      score: 1 - i / cs.length
    }));
  }
};
var TransformersReranker = class {
  name;
  pipelinePromise = null;
  modelId;
  failed = false;
  constructor(modelId = "Xenova/ms-marco-MiniLM-L-6-v2") {
    this.modelId = modelId;
    this.name = `xenova:${modelId.split("/").pop()}`;
  }
  async getPipeline() {
    if (this.failed) return null;
    if (!this.pipelinePromise) {
      this.pipelinePromise = (async () => {
        try {
          const modName = "@xenova/transformers";
          const mod = await import(
            /* @vite-ignore */
            modName
          );
          if (mod.env) {
            mod.env.allowLocalModels = mod.env.allowLocalModels ?? false;
            mod.env.useBrowserCache = false;
          }
          return await mod.pipeline("text-classification", this.modelId);
        } catch (e) {
          console.warn(`[reranker] failed to load ${this.modelId}:`, e.message);
          this.failed = true;
          return null;
        }
      })();
    }
    return this.pipelinePromise;
  }
  async rerank(query, candidates, topN) {
    if (candidates.length === 0) return [];
    const pipe = await this.getPipeline();
    if (!pipe) {
      return candidates.slice(0, topN ?? candidates.length).map((c, i) => ({
        candidate: c,
        score: 1 - i / candidates.length
      }));
    }
    try {
      const inputs = candidates.map((c) => ({
        text: query,
        text_pair: c.text.slice(0, 2e3)
      }));
      const out = await pipe(inputs, { topk: 1 });
      const scored = candidates.map((c, i) => {
        const r = Array.isArray(out[i]) ? out[i][0] : out[i];
        const s = typeof r?.score === "number" ? r.score : 0;
        return { candidate: c, score: s };
      });
      scored.sort((a, b) => b.score - a.score);
      return scored.slice(0, topN ?? scored.length);
    } catch (e) {
      console.warn("[reranker] rerank failed, fallback to identity:", e.message);
      return candidates.slice(0, topN ?? candidates.length).map((c, i) => ({
        candidate: c,
        score: 1 - i / candidates.length
      }));
    }
  }
};
function buildReranker(env2 = process.env) {
  const v = (env2.RERANKER ?? "off").trim();
  if (!v || v === "off" || v === "0" || v === "false") return new IdentityReranker();
  if (v === "on" || v === "1" || v === "true") return new TransformersReranker();
  return new TransformersReranker(v);
}

// ../server/src/retrieval.ts
async function hybridRetrieve(index, embedder, query, topK = 8, reranker) {
  const RRF_K = 60;
  const overFetch = reranker && reranker.name !== "identity" ? topK * 3 : topK * 2;
  const bmHits = index.bm25.search(query, overFetch);
  let vecHits = [];
  if (index.vectors.size() > 0) {
    try {
      const [v] = await embedder.embed([query]);
      vecHits = index.vectors.search(v, overFetch);
    } catch (e) {
      console.warn("[retrieval] vector search failed, falling back to BM25 only:", e.message);
    }
  }
  const scores = /* @__PURE__ */ new Map();
  bmHits.forEach((h, rank) => {
    const id = h.chunk.id;
    scores.set(id, {
      id,
      path: h.chunk.file,
      startLine: h.chunk.startLine,
      endLine: h.chunk.endLine,
      text: h.chunk.text,
      score: 1 / (RRF_K + rank + 1),
      sources: ["bm25"]
    });
  });
  vecHits.forEach((h, rank) => {
    const id = h.item.id;
    const existing = scores.get(id);
    if (existing) {
      existing.score += 1 / (RRF_K + rank + 1);
      if (!existing.sources.includes("vector")) existing.sources.push("vector");
    } else {
      scores.set(id, {
        id,
        path: h.item.path,
        startLine: h.item.startLine,
        endLine: h.item.endLine,
        text: h.item.text,
        score: 1 / (RRF_K + rank + 1),
        sources: ["vector"]
      });
    }
  });
  const fused = Array.from(scores.values()).sort((a, b) => b.score - a.score);
  if (reranker && reranker.name !== "identity" && fused.length > 1) {
    const candidates = fused.slice(0, overFetch).map((h) => ({
      id: h.id,
      text: h.text,
      meta: h
    }));
    try {
      const reranked = await reranker.rerank(query, candidates, topK);
      return reranked.map((r) => ({
        ...r.candidate.meta,
        rerankScore: r.score
      }));
    } catch (e) {
      console.warn("[retrieval] rerank failed, using RRF order:", e.message);
    }
  }
  return fused.slice(0, topK);
}

// ../server/src/exec-policy.ts
var AUTO_PROGRAMS = /* @__PURE__ */ new Set([
  // 读类
  "ls",
  "cat",
  "head",
  "tail",
  "wc",
  "file",
  "stat",
  "pwd",
  "which",
  "whoami",
  "date",
  "echo",
  "printf",
  // git 只读
  // ↓ git 的子命令在 isGitReadOnly 单独判断
  // 项目工具（典型 dev-loop，不会改 host）
  "node",
  "npm",
  "pnpm",
  "yarn",
  "npx",
  "tsc",
  "eslint",
  "prettier",
  "vitest",
  "jest",
  "mocha",
  "python",
  "python3",
  "pip",
  "pip3",
  // 搜索
  "grep",
  "rg",
  "ripgrep",
  "find",
  "fd",
  "ag",
  // 其他无害
  "jq",
  "yq",
  "tree",
  "env"
]);
var DENY_PROGRAMS = /* @__PURE__ */ new Set([
  "sudo",
  "su",
  "rm",
  // rm 单独看（有 -rf / 路径敏感）
  "chmod",
  "chown",
  "kill",
  "killall",
  "pkill",
  "shutdown",
  "reboot",
  "halt",
  "dd",
  "mkfs",
  "fdisk",
  "mount",
  "umount",
  // 远程执行
  "ssh",
  "scp",
  "sftp",
  "rsync",
  // shell 内联执行（用来绕白名单）
  "eval",
  "exec",
  "source",
  ".",
  // 包管理（host 级别副作用）
  "brew",
  "apt",
  "apt-get",
  "yum",
  "dnf",
  "pacman",
  // 加密/解密命令行（常被用来转储敏感数据）
  "gpg",
  "openssl"
]);
var DANGEROUS_PATTERNS = [
  { re: /(^|\s)-rf?\s+\/(\s|$)/, reason: "\u5C1D\u8BD5 rm -rf \u6839\u76EE\u5F55", to: "deny" },
  { re: /(^|\s)-rf?\s+~(\s|$)/, reason: "\u5C1D\u8BD5 rm -rf \u4E3B\u76EE\u5F55", to: "deny" },
  { re: /(^|\s)\/etc\//, reason: "\u8BBF\u95EE\u7CFB\u7EDF\u914D\u7F6E\u76EE\u5F55 /etc", to: "ask" },
  { re: /(^|\s)\/Users\/[^/\s]+\/\.ssh/, reason: "\u8BBF\u95EE SSH \u79C1\u94A5\u76EE\u5F55", to: "deny" },
  { re: /(^|\s)\$HOME\/\.ssh/, reason: "\u8BBF\u95EE SSH \u79C1\u94A5\u76EE\u5F55", to: "deny" },
  { re: /(^|\s)~\/\.ssh/, reason: "\u8BBF\u95EE SSH \u79C1\u94A5\u76EE\u5F55", to: "deny" },
  { re: /(^|\s)\.aws\//, reason: "\u8BBF\u95EE AWS \u51ED\u636E", to: "deny" },
  { re: /(^|\s)127\.0\.0\.1|localhost/, reason: "\u8BBF\u95EE\u672C\u673A\u670D\u52A1", to: "ask" },
  { re: /(^|\s)169\.254|192\.168|10\.\d|172\.(1[6-9]|2\d|3[01])\./, reason: "\u8BBF\u95EE\u5185\u7F51 IP", to: "ask" },
  // 反混淆 / 管道执行（curl|bash 等注入手法）
  { re: /base64\s+-d/, reason: "base64 \u89E3\u7801\u540E\u6267\u884C\u7684\u53CD\u6DF7\u6DC6", to: "deny" },
  { re: /base64\s+--decode/, reason: "base64 \u89E3\u7801\u540E\u6267\u884C\u7684\u53CD\u6DF7\u6DC6", to: "deny" },
  { re: /python[23]?\s+-c/, reason: "python -c \u5185\u8054\u6267\u884C", to: "ask" },
  { re: /node\s+-e\s/, reason: "node -e \u5185\u8054\u6267\u884C\uFF08\u53EF\u80FD\u7ED5\u8FC7\u9ED1\u540D\u5355\uFF09", to: "ask" },
  { re: /node\s+--eval\s/, reason: "node --eval \u5185\u8054\u6267\u884C\uFF08\u53EF\u80FD\u7ED5\u8FC7\u9ED1\u540D\u5355\uFF09", to: "ask" },
  { re: /bash\s+-c\s/, reason: "bash -c \u5185\u8054\u6267\u884C", to: "ask" },
  { re: /sh\s+-c\s/, reason: "sh -c \u5185\u8054\u6267\u884C", to: "ask" },
  // 危险写目标
  { re: />\s*\/dev\/(?!null)/, reason: "\u5199\u5165\u7279\u6B8A\u8BBE\u5907\u6587\u4EF6", to: "deny" },
  { re: />\s*~\/\.bashrc|>\s*~\/\.zshrc|>\s*~\/\.profile/, reason: "\u8986\u5199 shell \u914D\u7F6E\u6587\u4EF6", to: "deny" },
  { re: />\s*\/etc\//, reason: "\u5199\u5165\u7CFB\u7EDF\u914D\u7F6E\u76EE\u5F55", to: "deny" },
  // 环境变量泄露
  { re: /\$\{?AWS_SECRET|AWS_ACCESS_KEY|OPENAI_API_KEY|ANTHROPIC_API_KEY/, reason: "\u8BFB\u53D6\u654F\u611F\u73AF\u5883\u53D8\u91CF", to: "deny" },
  // crontab 注入
  { re: /crontab\s+-[lei]/, reason: "crontab \u4FEE\u6539\uFF08\u6301\u4E45\u5316\u540E\u95E8\u98CE\u9669\uFF09", to: "deny" },
  // launchctl / systemctl 持久化
  { re: /launchctl\s+load|systemctl\s+(enable|start)/, reason: "\u6CE8\u518C\u7CFB\u7EDF\u670D\u52A1", to: "deny" },
  // curl/wget 管道执行（最危险的注入手法之一）
  // 注意：单独的 curl 命令通过 decideSegment → ask；但在 pipeline 中跟 bash/sh/python 连接时由 splitPipeline 各段判定
  { re: /\b(curl|wget)\b.+\|\s*(bash|sh|python[23]?|node|perl|ruby)/, reason: "curl/wget \u7BA1\u9053\u5230\u89E3\u91CA\u5668\uFF08\u8FDC\u7A0B\u4EE3\u7801\u6267\u884C\uFF09", to: "deny" }
];
function splitPipeline(raw) {
  const sub = [];
  const cleaned = raw.replace(/\$\(([^)]+)\)/g, (_m, inner) => {
    sub.push(inner);
    return " ";
  }).replace(/`([^`]+)`/g, (_m, inner) => {
    sub.push(inner);
    return " ";
  });
  const parts = cleaned.split(/\|\||&&|\||;|\bthen\b|\bdo\b/g).map((s) => s.trim()).filter(Boolean);
  return [...parts, ...sub];
}
function programOf(segment) {
  const tokens = segment.trim().split(/\s+/);
  if (tokens.length === 0) return "";
  let p = tokens[0];
  while (/^[A-Z_][A-Z0-9_]*=/.test(p) && tokens.length > 1) {
    tokens.shift();
    p = tokens[0];
  }
  const slash = p.lastIndexOf("/");
  if (slash >= 0) p = p.slice(slash + 1);
  return p;
}
function isGitReadOnly(segment) {
  const tokens = segment.trim().split(/\s+/);
  if (tokens[0] !== "git") return false;
  const sub = tokens[1];
  const READ_ONLY_GIT = /* @__PURE__ */ new Set([
    "status",
    "diff",
    "log",
    "show",
    "blame",
    "branch",
    "remote",
    "config",
    "rev-parse",
    "rev-list",
    "ls-files",
    "ls-tree",
    "describe",
    "tag",
    "stash"
  ]);
  if (!sub) return false;
  if (sub === "config" && tokens.includes("--set")) return false;
  return READ_ONLY_GIT.has(sub);
}
function decideSegment(segment) {
  const seg = segment.trim();
  if (!seg) return { verdict: "auto", reason: "empty", matchedRule: "empty" };
  for (const p of DANGEROUS_PATTERNS) {
    if (p.re.test(seg)) {
      if (p.to === "deny") {
        return { verdict: "deny", reason: p.reason, matchedRule: "dangerous-pattern" };
      }
    }
  }
  const prog = programOf(seg);
  if (DENY_PROGRAMS.has(prog)) {
    if (prog === "rm" && !/\s-r?f?r?\s|\s-fr?\s/.test(seg)) {
      return { verdict: "ask", reason: "rm \u547D\u4EE4\u9700\u8981\u786E\u8BA4", matchedRule: "rm-soft" };
    }
    return { verdict: "deny", reason: `\u7981\u7528\u7A0B\u5E8F: ${prog}`, matchedRule: `deny-prog:${prog}` };
  }
  if (prog === "git") {
    if (isGitReadOnly(seg)) {
      return { verdict: "auto", reason: "git \u53EA\u8BFB\u5B50\u547D\u4EE4", matchedRule: "git-readonly" };
    }
    return { verdict: "ask", reason: "git \u5199\u7C7B\u64CD\u4F5C\uFF08commit/push/checkout \u7B49\uFF09\u9700\u8981\u786E\u8BA4", matchedRule: "git-write" };
  }
  if (AUTO_PROGRAMS.has(prog)) {
    for (const p of DANGEROUS_PATTERNS) {
      if (p.to === "ask" && p.re.test(seg)) {
        return { verdict: "ask", reason: p.reason, matchedRule: "dangerous-soft" };
      }
    }
    return { verdict: "auto", reason: `\u767D\u540D\u5355\u7A0B\u5E8F: ${prog}`, matchedRule: `auto-prog:${prog}` };
  }
  return { verdict: "ask", reason: `\u672A\u77E5\u7A0B\u5E8F ${prog || "(\u7A7A)"} \u9700\u8981\u786E\u8BA4`, matchedRule: "unknown" };
}
function decideCommand(command) {
  const segments = splitPipeline(command);
  if (segments.length === 0) {
    return { verdict: "ask", reason: "\u7A7A\u547D\u4EE4", matchedRule: "empty" };
  }
  let worst = { verdict: "auto", reason: "\u5168\u90E8\u767D\u540D\u5355", matchedRule: "all-auto" };
  for (const seg of segments) {
    const d = decideSegment(seg);
    if (d.verdict === "deny") return d;
    if (d.verdict === "ask" && worst.verdict === "auto") {
      worst = d;
    }
  }
  return worst;
}

// ../server/src/watcher.ts
import { promises as fs21 } from "node:fs";
import path22 from "node:path";
var DEFAULT_IGNORED = [
  /node_modules/,
  /\.git\//,
  /\.minicodeide/,
  /dist\//,
  /\.next\//,
  /\.cache\//,
  /\.DS_Store/
];
var IndexWatcher = class {
  constructor(opts) {
    this.opts = opts;
  }
  opts;
  watcher;
  /** 等待处理的文件队列：add/change/unlink */
  pending = /* @__PURE__ */ new Map();
  timer;
  flushing = false;
  start() {
    const ignored = [...DEFAULT_IGNORED, ...this.opts.ignored ?? []];
    this.watcher = chokidar_default.watch(this.opts.root, {
      ignored: (p) => ignored.some(
        (rule) => rule instanceof RegExp ? rule.test(p) : p.includes(rule)
      ),
      ignoreInitial: true,
      // 初始扫描由 builder 做
      persistent: true,
      awaitWriteFinish: { stabilityThreshold: 150, pollInterval: 50 }
    });
    this.watcher.on("add", (p) => this.enqueue(p, "add")).on("change", (p) => this.enqueue(p, "change")).on("unlink", (p) => this.enqueue(p, "unlink"));
    this.opts.onProgress?.(`[watcher] watching ${this.opts.root}`);
  }
  async stop() {
    await this.watcher?.close();
    if (this.timer) clearTimeout(this.timer);
  }
  enqueue(abs, kind) {
    const rel = path22.relative(this.opts.root, abs);
    if (!rel || rel.startsWith("..")) return;
    const existing = this.pending.get(rel);
    if (existing === "unlink" && kind !== "unlink") return;
    this.pending.set(rel, kind);
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => void this.flush(), this.opts.debounceMs ?? 300);
  }
  async flush() {
    if (this.flushing) {
      this.timer = setTimeout(() => void this.flush(), 200);
      return;
    }
    this.flushing = true;
    try {
      const idx = this.opts.index();
      if (!idx) {
        this.opts.onProgress?.("[watcher] index not ready, skip");
        return;
      }
      const batch = [...this.pending.entries()];
      this.pending.clear();
      const burst = this.opts.burstLimit ?? 200;
      if (batch.length > burst) {
        this.opts.onProgress?.(
          `[watcher] burst ${batch.length} > ${burst}; skip embedding this round (BM25 still updated)`
        );
      }
      const embedder = this.opts.embedder();
      const max = this.opts.maxFileSize ?? 5e5;
      const allNewItems = [];
      for (const [relPath, kind] of batch) {
        if (kind === "unlink") {
          idx.bm25.removeByPath(relPath);
          idx.symbols.remove(relPath);
          idx.vectors.upsertFile(relPath, []);
          continue;
        }
        const abs = path22.join(this.opts.root, relPath);
        let text = "";
        try {
          const stat4 = await fs21.stat(abs);
          if (!stat4.isFile()) continue;
          if (stat4.size > max) {
            this.opts.onProgress?.(`[watcher] skip ${relPath} (${stat4.size}b > ${max})`);
            continue;
          }
          text = await fs21.readFile(abs, "utf-8");
        } catch {
          idx.bm25.removeByPath(relPath);
          idx.symbols.remove(relPath);
          idx.vectors.upsertFile(relPath, []);
          continue;
        }
        const facts = extractFacts(relPath, text);
        const chunks = facts && facts.symbols.length > 0 ? chunkTextWithSymbols(
          relPath,
          text,
          facts.symbols.map((s) => ({ name: s.name, startLine: s.startLine, endLine: s.endLine }))
        ) : chunkText(relPath, text);
        idx.bm25.upsertFile(relPath, chunks);
        if (facts) idx.symbols.upsert(facts);
        if (batch.length <= burst && chunks.length) {
          try {
            const vecs = await embedder.embed(chunks.map((c) => `// ${c.path}
${c.text}`));
            const items = chunks.map((c, i) => ({
              id: c.id,
              path: c.path,
              startLine: c.startLine,
              endLine: c.endLine,
              text: c.text,
              vec: vecs[i],
              model: embedder.name
            }));
            idx.vectors.upsertFile(relPath, items);
            allNewItems.push(...items);
          } catch (e) {
            this.opts.onProgress?.(`[watcher] embed failed ${relPath}: ${e.message}`);
          }
        } else {
          idx.vectors.upsertFile(relPath, []);
        }
      }
      this.opts.onProgress?.(
        `[watcher] flushed ${batch.length} change(s); +${allNewItems.length} vectors`
      );
      if (this.opts.onFileChange && batch.length > 0) {
        this.opts.onFileChange(batch.map(([path27, kind]) => ({ path: path27, kind })));
      }
      if (allNewItems.length) {
        idx.vectors.save(this.opts.vectorPath()).catch((e) => {
          console.warn("[watcher] vectors.save failed:", e.message);
        });
      }
    } finally {
      this.flushing = false;
    }
  }
};

// src/approvals.ts
var ApprovalsStore = class {
  waiting = /* @__PURE__ */ new Map();
  list() {
    return [...this.waiting.values()].map(({ resolver: _r, ...rest }) => rest);
  }
  /** 加入等待队列；返回 Promise，resolve 时拿到决定 */
  enqueue(cmd) {
    const id = `apv_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    return new Promise((resolve3) => {
      this.waiting.set(id, { id, cmd, ts: Date.now(), resolver: resolve3 });
    });
  }
  /** 通过 id 决议 */
  decide(id, decision) {
    const r = this.waiting.get(id);
    if (!r) return false;
    this.waiting.delete(id);
    r.resolver(decision);
    return true;
  }
};

// src/env.ts
import path23 from "node:path";
var env = {
  PORT: Number(process.env.PORT ?? 5175),
  WORKSPACE: process.env.WORKSPACE ? path23.resolve(process.env.WORKSPACE) : process.cwd(),
  AUTH_TOKEN: process.env.MINI_AUTH_TOKEN?.trim() || "",
  AUTH_TOKENS: (process.env.MINI_AUTH_TOKENS ?? "").split(",").map((s) => s.trim()).filter(Boolean),
  RATE_LIMIT: Number(process.env.MINI_RATE_LIMIT ?? 0),
  RATE_LIMIT_CHAT: Number(process.env.MINI_RATE_LIMIT_CHAT ?? 0),
  LOG_LEVEL: (process.env.MINI_LOG_LEVEL ?? "info").toLowerCase()
};

// src/services.ts
var Services = class {
  workspace;
  providers;
  memory;
  injectionCache;
  recentActivity;
  registry;
  pendingEdits;
  checkpoints;
  rules;
  projectMemory;
  slash;
  sessions;
  skills;
  subagents;
  mcpManager;
  approvals;
  llmChat;
  llmComplete;
  llmFast;
  embedder;
  reranker;
  vectorPath;
  index = null;
  indexing = false;
  watcher;
  /** 文件变更 SSE 客户端集合 */
  fsEventClients = /* @__PURE__ */ new Set();
  constructor(workspace) {
    this.workspace = workspace;
  }
  /** Live workspace switch (used by POST /api/workspace/switch).
   *  - 重置 workspace 字段
   *  - 停掉旧 watcher
   *  - 把指向 workspace 路径的子 store 重新指过去
   *  - 重新构建 index（异步）
   *
   *  注意：LSP / terminal bridge 是 ws upgrade 在主进程已经绑定 cwd，热切换需要前端
   *  断开重连这些 ws；目前我们仅热切换 file APIs + index，足够 explorer / chat 用。
   */
  async switchWorkspace(next) {
    if (!next || next === this.workspace) return;
    console.log(`[server-node] switching workspace: ${this.workspace} -> ${next}`);
    try {
      this.watcher?.stop?.();
    } catch {
    }
    this.workspace = next;
    this.providers = new ProviderStore(this.workspace);
    await this.providers.load();
    this.vectorPath = path24.join(
      this.workspace,
      ".minicodeide",
      `vectors.${this.embedder.name.replace(/[^a-z0-9]+/gi, "_")}.jsonl`
    );
    this.pendingEdits = new PendingEditStore(this.workspace);
    this.checkpoints = new CheckpointStore(this.workspace);
    await this.checkpoints.init();
    this.rules = new RulesStore(this.workspace);
    await this.rules.load();
    this.projectMemory = new ProjectMemoryStore(this.workspace);
    await this.projectMemory.load();
    this.slash = new SlashCommandRegistry(this.workspace);
    await this.slash.loadUser();
    this.sessions = new SessionStore(this.workspace);
    await this.sessions.load();
    this.skills = new SkillStore(this.workspace);
    await this.skills.load();
    try {
      await this.mcpManager?.closeAll();
    } catch {
    }
    this.mcpManager = new McpManager(this.workspace);
    await this.mcpManager.loadAndConnect();
    this.mcpManager.registerToolsTo(this.registry);
    this.index = null;
    this.watcher = new IndexWatcher({
      root: this.workspace,
      index: () => this.index,
      embedder: () => this.embedder,
      vectorPath: () => this.vectorPath,
      onProgress: (m) => console.log(m),
      onFileChange: (events) => {
        const data = JSON.stringify({ type: "fs_change", events });
        for (const client of this.fsEventClients) {
          try {
            client.write(`data: ${data}

`);
          } catch {
          }
        }
      }
    });
    this.watcher.start();
    void this.ensureIndex();
  }
  async init() {
    this.providers = new ProviderStore(this.workspace);
    await this.providers.load();
    this.llmChat = this.buildLlmFor("chat");
    this.llmComplete = this.buildLlmFor("complete");
    this.llmFast = this.buildLlmFor("fast");
    this.embedder = this.buildEmbedderFor();
    this.reranker = buildReranker();
    this.vectorPath = path24.join(
      this.workspace,
      ".minicodeide",
      `vectors.${this.embedder.name.replace(/[^a-z0-9]+/gi, "_")}.jsonl`
    );
    this.providers.onChange = () => {
      this.llmChat = this.buildLlmFor("chat");
      this.llmComplete = this.buildLlmFor("complete");
      this.llmFast = this.buildLlmFor("fast");
      const oldName = this.embedder.name;
      this.embedder = this.buildEmbedderFor();
      if (this.embedder.name !== oldName) {
        this.vectorPath = path24.join(
          this.workspace,
          ".minicodeide",
          `vectors.${this.embedder.name.replace(/[^a-z0-9]+/gi, "_")}.jsonl`
        );
        this.index = null;
        void this.ensureIndex();
      }
      this.memory.setEmbedder(this.buildMemoryEmbedder());
    };
    this.memory = new MemoryStore({
      projectPath: this.workspace,
      embedder: this.buildMemoryEmbedder()
    });
    this.injectionCache = new InjectionCache({ perSessionCap: 100, maxSessions: 64 });
    this.recentActivity = new RecentActivityTracker({ perSessionCap: 30, ttlMs: 30 * 60 * 1e3 });
    this.memory.maintain().catch(() => void 0);
    const t = setInterval(
      () => {
        this.memory.maintain().catch(() => void 0);
      },
      6 * 60 * 60 * 1e3
    );
    t.unref?.();
    this.registry = new ToolRegistry();
    registerBuiltinTools(this.registry);
    this.pendingEdits = new PendingEditStore(this.workspace);
    this.checkpoints = new CheckpointStore(this.workspace);
    await this.checkpoints.init();
    this.pendingEdits.onBeforeWrite = async (edits) => {
      if (!edits.length) return;
      await this.checkpoints.create({
        label: edits.length === 1 ? `accept ${edits[0].path}` : `accept ${edits.length} files`,
        trigger: edits.length === 1 ? "accept" : "accept_all",
        files: edits.map((e) => ({ path: e.path, newContent: e.newContent }))
      });
      await this.checkpoints.prune(100);
    };
    this.rules = new RulesStore(this.workspace);
    await this.rules.load();
    this.projectMemory = new ProjectMemoryStore(this.workspace);
    await this.projectMemory.load();
    this.slash = new SlashCommandRegistry(this.workspace);
    await this.slash.loadUser();
    this.sessions = new SessionStore(this.workspace);
    await this.sessions.load();
    this.skills = new SkillStore(this.workspace);
    await this.skills.load();
    this.approvals = new ApprovalsStore();
    this.subagents = new SubagentManager({
      llm: () => this.llmFast ?? this.llmChat,
      sessions: this.sessions,
      workspaceRoot: this.workspace,
      defaultModel: () => this.providers.getActive("fast")?.model ?? this.providers.getActive("chat")?.model,
      childToolCtxFactory: () => ({
        cwd: this.workspace,
        execPolicy: (cmd) => decideCommand(cmd),
        codeIntel: {
          findSymbol: async (q, limit) => this.index ? this.index.symbols.fuzzyFind(q, limit ?? 15) : [],
          findReferences: async (name) => this.index ? this.index.symbols.findReferences(name) : [],
          semanticSearch: async (q, k) => this.index ? hybridRetrieve(this.index, this.embedder, q, k ?? 8, this.reranker) : [],
          listFileSymbols: async (p) => this.index ? this.index.symbols.symbolsInFile(p) : []
        },
        skills: {
          list: () => this.skills.list().map((s) => ({
            name: s.name,
            description: s.description,
            source: s.source
          })),
          loadFull: async (name) => {
            const f = await this.skills.loadFull(name);
            if (!f) return null;
            return {
              name: f.name,
              description: f.description,
              body: f.body,
              directory: f.directory,
              supportFiles: f.supportFiles
            };
          }
        }
      })
    });
    this.mcpManager = new McpManager(this.workspace);
    const mcpResults = await this.mcpManager.loadAndConnect();
    if (mcpResults.length) {
      for (const r of mcpResults) {
        if (r.ok) console.log(`[MCP] ${r.name} connected (${r.toolCount ?? 0} tools)`);
        else console.log(`[MCP] ${r.name} failed: ${r.error}`);
      }
      this.mcpManager.registerToolsTo(this.registry);
    }
    this.watcher = new IndexWatcher({
      root: this.workspace,
      index: () => this.index,
      embedder: () => this.embedder,
      vectorPath: () => this.vectorPath,
      onProgress: (m) => console.log(m),
      onFileChange: (events) => {
        const data = JSON.stringify({ type: "fs_change", events });
        for (const client of this.fsEventClients) {
          try {
            client.write(`data: ${data}

`);
          } catch {
          }
        }
      }
    });
    this.watcher.start();
    void this.ensureIndex();
  }
  buildLlmFor(role, onSwitch) {
    const chain = this.providers.getRoleChain(role);
    if (chain.length === 0) {
      return new OpenAICompatProvider({
        baseURL: "https://api.deepseek.com/v1",
        apiKey: "sk-mock",
        defaultModel: "deepseek-chat",
        embedModel: "text-embedding-3-small"
      });
    }
    return new LLMRouter({ profiles: chain, onSwitch });
  }
  buildEmbedderFor() {
    const p = this.providers.getActive("embed");
    if (!p || p.hash) return createEmbedder({ provider: "hash" });
    return createEmbedder({
      provider: "openai",
      baseUrl: p.baseUrl,
      apiKey: p.apiKey,
      model: p.embedModel ?? "text-embedding-3-small",
      dim: p.embedDim
    });
  }
  buildMemoryEmbedder() {
    const emb = this.embedder;
    return {
      name: emb.name,
      async embed(texts) {
        const vecs = await emb.embed(texts);
        return vecs.map((v) => Array.from(v));
      }
    };
  }
  async ensureIndex() {
    if (this.index || this.indexing) return;
    this.indexing = true;
    try {
      this.index = await buildIndex(
        this.workspace,
        { embedder: this.embedder, vectorPath: this.vectorPath, reuseVectors: true },
        () => void 0
      );
      console.log(`[indexer] done: ${this.index.fileCount} files, ${this.index.chunkCount} chunks`);
    } catch (e) {
      console.error("[indexer] failed", e);
    } finally {
      this.indexing = false;
    }
  }
};

// src/router/router.ts
function compile(pattern) {
  const paramNames = [];
  const body = pattern.replace(/[.+?^${}()|[\]\\]/g, "\\$&").replace(/\/:([\w]+)/g, (_m, name) => {
    paramNames.push(name);
    return "/([^/]+)";
  }).replace(/\\\*/g, "(.*)");
  return { regex: new RegExp(`^${body}$`), paramNames };
}
var Router = class {
  routes = [];
  add(method, pattern, handler) {
    const { regex, paramNames } = compile(pattern);
    this.routes.push({ method, pattern, regex, paramNames, handler });
  }
  get(p, h) {
    this.add("GET", p, h);
  }
  post(p, h) {
    this.add("POST", p, h);
  }
  put(p, h) {
    this.add("PUT", p, h);
  }
  patch(p, h) {
    this.add("PATCH", p, h);
  }
  delete(p, h) {
    this.add("DELETE", p, h);
  }
  /** 查找匹配；不匹配返回 null */
  match(method, pathname) {
    for (const route of this.routes) {
      if (route.method !== method) continue;
      const m = route.regex.exec(pathname);
      if (!m) continue;
      const params = {};
      route.paramNames.forEach((name, i) => {
        params[name] = decodeURIComponent(m[i + 1]);
      });
      return { route, params };
    }
    return null;
  }
  /** 路由表快照（debug 用） */
  snapshot() {
    return this.routes.map((r) => `${r.method} ${r.pattern}`);
  }
};

// src/router/http-utils.ts
var CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, PATCH, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Mini-Token",
  "Access-Control-Max-Age": "86400"
};
function sendJson(res, status, body) {
  if (res.writableEnded) return;
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...CORS_HEADERS
  });
  res.end(JSON.stringify(body));
}
function sendText(res, status, body, contentType = "text/plain; charset=utf-8") {
  if (res.writableEnded) return;
  res.writeHead(status, { "Content-Type": contentType, ...CORS_HEADERS });
  res.end(body);
}
async function readBody(req, opts) {
  const limit = opts?.limit ?? 4 * 1024 * 1024;
  const chunks = [];
  let total = 0;
  for await (const c of req) {
    total += c.length;
    if (total > limit) {
      throw new Error(`request body too large (${total} > ${limit})`);
    }
    chunks.push(c);
  }
  if (total === 0) return void 0;
  const raw = Buffer.concat(chunks).toString("utf-8");
  const ct = (req.headers["content-type"] ?? "").toLowerCase();
  if (ct.includes("application/json")) {
    try {
      return JSON.parse(raw);
    } catch (e) {
      throw new Error(`invalid JSON body: ${e.message}`);
    }
  }
  return raw;
}
function openSse(req, res) {
  if (!res.headersSent) {
    res.writeHead(200, {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
      ...CORS_HEADERS
    });
  }
  const ac = new AbortController();
  let ended = false;
  const cleanup = () => {
    if (ended) return;
    ended = true;
    ac.abort();
  };
  req.once("close", cleanup);
  res.once("close", cleanup);
  res.once("error", cleanup);
  const keepalive = setInterval(() => {
    if (ended || res.writableEnded) return;
    try {
      res.write(":\n\n");
    } catch {
      cleanup();
    }
  }, 15e3);
  keepalive.unref?.();
  return {
    send(data) {
      if (ended || res.writableEnded) return;
      try {
        const payload = typeof data === "string" ? data : JSON.stringify(data);
        res.write(`data: ${payload}

`);
      } catch {
        cleanup();
      }
    },
    end() {
      if (ended) return;
      clearInterval(keepalive);
      try {
        res.end();
      } catch {
      }
      cleanup();
    },
    get aborted() {
      return ac.signal.aborted;
    },
    get signal() {
      return ac.signal;
    }
  };
}
function queryToObject(url) {
  const out = {};
  for (const [k, v] of url.searchParams) out[k] = v;
  return out;
}

// src/handlers/register.ts
import path26 from "node:path";
import os4 from "node:os";
import { promises as fs23 } from "node:fs";

// ../server/src/mentions.ts
import { promises as fs22 } from "node:fs";
import path25 from "node:path";
var MENTION_REGEX = /@(file|symbol|selection|docs|web):([^\s]+)/g;
var MAX_FILE_LINES = 400;
async function parseMentions(text, ctx) {
  const items = [];
  const unresolved = [];
  const matches = [];
  for (const m of text.matchAll(MENTION_REGEX)) {
    matches.push({ kind: m[1], arg: m[2], raw: m[0] });
  }
  for (const { kind, arg, raw } of matches) {
    try {
      switch (kind) {
        case "file":
        case "selection": {
          const m = arg.match(/^(.+?)(?::(\d+)-(\d+))?$/);
          if (!m) {
            unresolved.push({ kind, arg, reason: "invalid syntax" });
            break;
          }
          const rel = m[1];
          const startLine = m[2] ? Number(m[2]) : void 0;
          const endLine = m[3] ? Number(m[3]) : void 0;
          const item = await resolveFile(ctx.workspace, rel, startLine, endLine);
          if (item) items.push(item);
          else unresolved.push({ kind, arg, reason: "file not found" });
          break;
        }
        case "symbol": {
          if (!ctx.index) {
            unresolved.push({ kind, arg, reason: "index not ready" });
            break;
          }
          const found = ctx.index.symbols.fuzzyFind(arg, 1);
          if (!found.length) {
            unresolved.push({ kind, arg, reason: "symbol not found" });
            break;
          }
          const sym = found[0];
          const item = await resolveFile(
            ctx.workspace,
            sym.path,
            Math.max(1, sym.startLine - 2),
            sym.endLine + 30
          );
          if (item) {
            item.type = "symbol";
            item.label = `${sym.name} (${sym.kind})`;
            items.push(item);
          } else {
            unresolved.push({ kind, arg, reason: "cannot read symbol file" });
          }
          break;
        }
        case "docs": {
          const candidates = [`docs/${arg}.md`, `${arg}.md`];
          let found = null;
          for (const rel of candidates) {
            const item = await resolveFile(ctx.workspace, rel);
            if (item) {
              found = item;
              break;
            }
          }
          if (found) items.push(found);
          else unresolved.push({ kind, arg, reason: "doc not found" });
          break;
        }
        case "web": {
          unresolved.push({ kind, arg, reason: "web search not enabled" });
          break;
        }
        default:
          unresolved.push({ kind, arg, reason: `unknown mention kind: ${kind}` });
      }
    } catch (e) {
      unresolved.push({ kind, arg, reason: e?.message ?? String(e) });
    }
  }
  const cleanText = text.replace(MENTION_REGEX, " ").replace(/\s+/g, " ").trim();
  return { cleanText, items, unresolved };
}
async function resolveFile(workspace, rel, startLine, endLine) {
  const safeRel = rel.replace(/^\/+/, "").replace(/\.\.\//g, "");
  const abs = path25.join(workspace, safeRel);
  let raw;
  try {
    raw = await fs22.readFile(abs, "utf-8");
  } catch {
    return null;
  }
  const lines = raw.split("\n");
  const total = lines.length;
  let start = startLine ?? 1;
  let end = endLine ?? Math.min(total, MAX_FILE_LINES);
  if (!startLine && total > MAX_FILE_LINES) {
    end = MAX_FILE_LINES;
  }
  start = Math.max(1, start);
  end = Math.min(total, end);
  const slice = lines.slice(start - 1, end).join("\n");
  const label = startLine && endLine ? `${safeRel}:${startLine}-${endLine}` : safeRel;
  return {
    type: "file",
    label,
    content: slice + (end < total && !endLine ? `
... (truncated, total ${total} lines)` : "")
  };
}

// ../server/src/git-helpers.ts
import { exec as _exec } from "node:child_process";
import { promisify as promisify3 } from "node:util";
var exec = promisify3(_exec);
var MAX_BUFFER2 = 32 * 1024 * 1024;
async function run(cmd, cwd) {
  const { stdout } = await exec(cmd, { cwd, maxBuffer: MAX_BUFFER2 });
  return stdout;
}
async function isGitRepo(cwd) {
  try {
    await run("git rev-parse --is-inside-work-tree", cwd);
    return true;
  } catch {
    return false;
  }
}
async function gitStatus(cwd) {
  const out = await run("git status --porcelain", cwd);
  const result = [];
  for (const ln of out.split("\n")) {
    if (!ln) continue;
    const x = ln[0];
    const y = ln[1];
    const p = ln.slice(3).trim();
    if (x !== " " && x !== "?") {
      result.push({ status: x, path: p, staged: true });
    }
    if (y !== " " && (y !== " " || x === "?")) {
      result.push({ status: y === " " ? x : y, path: p, staged: false });
    }
  }
  return result;
}
async function gitDiff(cwd, opts = {}) {
  const args = ["diff"];
  if (opts.staged) args.push("--cached");
  if (opts.path) args.push("--", opts.path.replace(/'/g, "'\\''"));
  return run("git " + args.join(" "), cwd);
}
async function gitBranch(cwd) {
  return (await run("git rev-parse --abbrev-ref HEAD", cwd)).trim();
}
async function gitLog(cwd, n = 20) {
  const fmt = "%H%x1f%h%x1f%aI%x1f%an%x1f%s";
  const out = await run(`git log --pretty=format:${fmt} -n ${n}`, cwd);
  return out.split("\n").filter(Boolean).map((ln) => {
    const [hash, shortHash, date, author, subject] = ln.split("");
    return { hash, shortHash, date, author, subject };
  });
}
async function gitCommit(cwd, message, paths = []) {
  if (paths.length === 0) {
    await run("git add -A", cwd);
  } else {
    const safe = paths.map((p) => `'${p.replace(/'/g, "'\\''")}'`).join(" ");
    await run(`git add ${safe}`, cwd);
  }
  const file = `/tmp/.minicodeide-commit-${Date.now()}.txt`;
  const fs24 = await import("node:fs/promises");
  await fs24.writeFile(file, message, "utf-8");
  try {
    await run(`git commit -F '${file}'`, cwd);
  } finally {
    await fs24.unlink(file).catch(() => void 0);
  }
  const log = await gitLog(cwd, 1);
  return { hash: log[0]?.hash ?? "", subject: log[0]?.subject ?? "" };
}

// src/handlers/register.ts
function detectMultiStepHint(userMessage) {
  const patterns = [
    /\b(all|every|each)\b.*\b(file|function|class|method)\b/i,
    /(\d+[.)]\s+.+){2,}/,
    /\b(then|and then|after that|next)\b/i,
    /先.{2,20}再.{2,20}/,
    /分别|并行|同时|批量|全部|所有/,
    /parallel|simultaneously/i
  ];
  const isMultiStep = patterns.some((p) => p.test(userMessage));
  const pathMatches = userMessage.match(/\b[\w\/.-]+\.\w{1,6}\b/g) ?? [];
  const hasMultiFile = new Set(pathMatches).size >= 3;
  if (!isMultiStep && !hasMultiFile) return null;
  return "\n[context] This user message appears to involve multiple steps or files. IMPORTANT: Before executing, call `update_plan` to list all steps with status=pending, set the first step to in_progress, then execute. Update after each step.";
}
function globToRegex2(glob) {
  let out = "^";
  let i = 0;
  while (i < glob.length) {
    const c = glob[i];
    if (c === "*") {
      if (glob[i + 1] === "*") {
        out += ".*";
        i += 2;
      } else {
        out += "[^/]*";
        i++;
      }
    } else if (c === "?") {
      out += ".";
      i++;
    } else if (c === "{") {
      const end = glob.indexOf("}", i);
      if (end < 0) {
        out += "\\{";
        i++;
      } else {
        const opts = glob.slice(i + 1, end).split(",").map((x) => x.replace(/[.+^$()|[\]\\]/g, "\\$&"));
        out += "(?:" + opts.join("|") + ")";
        i = end + 1;
      }
    } else if (/[.+^$()|[\]\\]/.test(c)) {
      out += "\\" + c;
      i++;
    } else {
      out += c;
      i++;
    }
  }
  out += "$";
  return new RegExp(out);
}
var VSCODE_TARGET = process.env.VSCODE_URL ?? "http://127.0.0.1:8000";
function registerHandlers(r, s) {
  r.get("/health", (c) => sendJson(c.res, 200, { ok: true, ts: Date.now() }));
  r.get("/api/health", (c) => sendJson(c.res, 200, {
    ok: true,
    indexReady: !!s.index,
    workspace: s.workspace,
    fileCount: s.index?.fileCount,
    chunkCount: s.index?.chunkCount,
    symbolCount: s.index?.symbolCount,
    vectorCount: s.index?.vectors.size(),
    embedder: s.index?.embedderName ?? s.embedder.name,
    reranker: s.reranker.name,
    ts: Date.now()
  }));
  r.get("/api/version", (c) => sendJson(c.res, 200, {
    version: process.env.npm_package_version ?? "0.0.0-dev",
    node: process.version,
    platform: `${os4.platform()} ${os4.arch()}`
  }));
  r.get("/api/metrics", (c) => sendJson(c.res, 200, { ok: true, ts: Date.now() }));
  r.get("/api/approvals", (c) => sendJson(c.res, 200, s.approvals.list()));
  r.post("/api/approve/:id", async (c) => {
    const body = await readBody(c.req);
    const decision = body?.ok === true ? "allow" : "deny";
    const ok = s.approvals.decide(c.params.id, decision);
    if (!ok) return sendJson(c.res, 404, { error: "not found or expired" });
    sendJson(c.res, 200, { ok: true });
  });
  const composerSubscribers = /* @__PURE__ */ new Set();
  r.post("/api/composer/forward", async (c) => {
    const body = await readBody(c.req);
    if (!body?.event) return sendJson(c.res, 400, { error: "missing event" });
    const ev = { event: String(body.event), payload: body.payload ?? {} };
    composerSubscribers.forEach((fn) => {
      try {
        fn(ev);
      } catch {
      }
    });
    sendJson(c.res, 200, { ok: true, subscribers: composerSubscribers.size });
  });
  r.get("/api/composer/events", async (c) => {
    const sse = openSse(c.req, c.res);
    const handler = (ev) => sse.send(ev);
    composerSubscribers.add(handler);
    sse.send({ event: "ready", payload: {} });
    c.req.on("close", () => composerSubscribers.delete(handler));
  });
  r.get("/api/vscode/health", async (c) => {
    try {
      const resp = await fetch(VSCODE_TARGET + "/", { redirect: "manual" });
      sendJson(c.res, 200, { ok: resp.status < 500, status: resp.status, url: VSCODE_TARGET });
    } catch (e) {
      sendJson(c.res, 200, { ok: false, error: e?.message ?? String(e), url: VSCODE_TARGET });
    }
  });
  r.get("/api/fs/events", (c) => {
    const sse = openSse(c.req, c.res);
    sse.send({ type: "fs_heartbeat" });
    s.fsEventClients.add(c.res);
    c.req.on("close", () => {
      s.fsEventClients.delete(c.res);
    });
  });
  r.get("/api/files", async (c) => {
    const rel = c.query.path ?? ".";
    const abs = path26.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: "escape" });
    try {
      const entries = await fs23.readdir(abs, { withFileTypes: true });
      sendJson(c.res, 200, entries.filter((e) => !["node_modules", ".git", "dist"].includes(e.name)).map((e) => ({
        name: e.name,
        path: path26.relative(s.workspace, path26.join(abs, e.name)),
        isDir: e.isDirectory()
      })).sort((a, b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.get("/api/file", async (c) => {
    const rel = c.query.path ?? "";
    const abs = path26.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: "escape" });
    try {
      const text = await fs23.readFile(abs, "utf-8");
      sendJson(c.res, 200, { path: rel, content: text });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.post("/api/file", async (c) => {
    const body = await readBody(c.req);
    const { path: rel, content } = body ?? {};
    const abs = path26.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: "escape" });
    try {
      await fs23.mkdir(path26.dirname(abs), { recursive: true });
      await fs23.writeFile(abs, content ?? "", "utf-8");
      sendJson(c.res, 200, { ok: true });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.delete("/api/file", async (c) => {
    const rel = c.query.path ?? "";
    if (!rel || rel === "." || rel === "/") return sendJson(c.res, 400, { error: "invalid path" });
    const abs = path26.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace) || abs === s.workspace) return sendJson(c.res, 400, { error: "escape" });
    try {
      await fs23.rm(abs, { recursive: true, force: true });
      sendJson(c.res, 200, { ok: true });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.post("/api/file/rename", async (c) => {
    const body = await readBody(c.req);
    const { from, to } = body ?? {};
    if (!from || !to) return sendJson(c.res, 400, { error: "from/to required" });
    const fromAbs = path26.resolve(s.workspace, from);
    const toAbs = path26.resolve(s.workspace, to);
    if (!fromAbs.startsWith(s.workspace) || !toAbs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: "escape" });
    try {
      try {
        await fs23.access(toAbs);
        return sendJson(c.res, 409, { error: "target exists" });
      } catch {
      }
      await fs23.mkdir(path26.dirname(toAbs), { recursive: true });
      await fs23.rename(fromAbs, toAbs);
      sendJson(c.res, 200, { ok: true });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.post("/api/folder", async (c) => {
    const body = await readBody(c.req);
    const { path: rel } = body ?? {};
    if (!rel) return sendJson(c.res, 400, { error: "path required" });
    const abs = path26.resolve(s.workspace, rel);
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: "escape" });
    try {
      await fs23.mkdir(abs, { recursive: true });
      sendJson(c.res, 200, { ok: true });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.post("/api/file/reveal", async (c) => {
    const body = await readBody(c.req);
    const { path: rel } = body ?? {};
    const abs = path26.resolve(s.workspace, rel ?? "");
    if (!abs.startsWith(s.workspace)) return sendJson(c.res, 400, { error: "escape" });
    try {
      const { spawn: spawn4 } = await import("child_process");
      const platform = process.platform;
      if (platform === "darwin") spawn4("open", ["-R", abs], { detached: true }).unref();
      else if (platform === "win32") spawn4("explorer", ["/select,", abs], { detached: true }).unref();
      else spawn4("xdg-open", [path26.dirname(abs)], { detached: true }).unref();
      sendJson(c.res, 200, { ok: true });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.get("/api/fs/list-abs", async (c) => {
    const os5 = await import("node:os");
    let abs = c.query.path ?? os5.homedir();
    abs = path26.resolve(abs);
    try {
      const entries = await fs23.readdir(abs, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => ({ name: e.name, path: path26.join(abs, e.name) })).sort((a, b) => a.name.localeCompare(b.name));
      sendJson(c.res, 200, {
        path: abs,
        parent: path26.dirname(abs) === abs ? null : path26.dirname(abs),
        home: os5.homedir(),
        dirs
      });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message, path: abs });
    }
  });
  r.get("/api/workspace", (c) => {
    sendJson(c.res, 200, { path: s.workspace });
  });
  r.post("/api/workspace/switch", async (c) => {
    const body = await readBody(c.req);
    const { path: next } = body ?? {};
    if (!next || typeof next !== "string") return sendJson(c.res, 400, { error: "path required" });
    const abs = path26.resolve(next);
    try {
      const st = await fs23.stat(abs);
      if (!st.isDirectory()) return sendJson(c.res, 400, { error: "not a directory" });
      await s.switchWorkspace(abs);
      sendJson(c.res, 200, { ok: true, workspace: s.workspace });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  function safeJoin(rootAbs, rel) {
    const target = path26.resolve(rootAbs, rel || ".");
    return target === rootAbs || target.startsWith(rootAbs + path26.sep) ? target : null;
  }
  r.get("/api/agents/files", async (c) => {
    const ws = c.query.ws;
    if (!ws || !path26.isAbsolute(ws)) return sendJson(c.res, 400, { error: "absolute ws required" });
    const target = safeJoin(ws, c.query.path ?? ".");
    if (!target) return sendJson(c.res, 400, { error: "escape" });
    try {
      const entries = await fs23.readdir(target, { withFileTypes: true });
      sendJson(c.res, 200, entries.filter((e) => !["node_modules", ".git", "dist", ".next", ".turbo"].includes(e.name)).map((e) => ({
        name: e.name,
        path: path26.relative(ws, path26.join(target, e.name)),
        isDir: e.isDirectory()
      })).sort((a, b) => a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.get("/api/agents/file", async (c) => {
    const ws = c.query.ws;
    if (!ws || !path26.isAbsolute(ws)) return sendJson(c.res, 400, { error: "absolute ws required" });
    const target = safeJoin(ws, c.query.path ?? "");
    if (!target) return sendJson(c.res, 400, { error: "escape" });
    try {
      const st = await fs23.stat(target);
      if (st.size > 2 * 1024 * 1024) return sendJson(c.res, 413, { error: "file too large (>2MB)" });
      const text = await fs23.readFile(target, "utf-8");
      sendJson(c.res, 200, { path: c.query.path ?? "", content: text, size: st.size });
    } catch (e) {
      sendJson(c.res, 500, { error: e.message });
    }
  });
  r.get("/api/agents/git/branch", async (c) => {
    const ws = c.query.ws;
    if (!ws || !path26.isAbsolute(ws)) return sendJson(c.res, 400, { error: "absolute ws required" });
    try {
      if (!await isGitRepo(ws)) return sendJson(c.res, 200, { isRepo: false });
      const branch = await gitBranch(ws);
      sendJson(c.res, 200, { isRepo: true, branch });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/agents/list-dirs", async (c) => {
    const parent = c.query.parent || os4.homedir();
    if (!path26.isAbsolute(parent)) return sendJson(c.res, 400, { error: "absolute parent required" });
    try {
      const entries = await fs23.readdir(parent, { withFileTypes: true });
      const dirs = entries.filter((e) => e.isDirectory() && !e.name.startsWith(".")).map((e) => ({ name: e.name, path: path26.join(parent, e.name) })).sort((a, b) => a.name.localeCompare(b.name));
      sendJson(c.res, 200, { parent, home: os4.homedir(), dirs });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/search", (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false, hits: [] });
    const hits = s.index.bm25.search(c.query.q ?? "", 8);
    sendJson(c.res, 200, { ready: true, hits });
  });
  r.get("/api/grep", async (c) => {
    const pattern = c.query.pattern ?? "";
    const caseInsensitive = c.query.ci === "1" || c.query.ci === "true";
    const includeGlob = c.query.include ?? "";
    const maxHits = Math.min(500, Number(c.query.limit ?? 200));
    if (!pattern) return sendJson(c.res, 200, { ready: true, hits: [] });
    let re;
    try {
      re = new RegExp(pattern, caseInsensitive ? "i" : "");
    } catch (e) {
      return sendJson(c.res, 400, { error: `Invalid regex: ${e?.message ?? e}` });
    }
    const globRe = includeGlob ? globToRegex2(includeGlob) : null;
    const hits = [];
    let scanned = 0;
    const skipDirs = /* @__PURE__ */ new Set(["node_modules", "dist", "build", ".git", ".next", ".cache"]);
    const walk2 = async (dir) => {
      if (hits.length >= maxHits) return;
      let entries = [];
      try {
        entries = await fs23.readdir(dir, { withFileTypes: true });
      } catch {
        return;
      }
      for (const e of entries) {
        if (hits.length >= maxHits) return;
        if (e.name.startsWith(".") || skipDirs.has(e.name)) continue;
        const full = path26.join(dir, e.name);
        if (e.isDirectory()) await walk2(full);
        else {
          if (globRe && !globRe.test(e.name)) continue;
          scanned++;
          try {
            const text = await fs23.readFile(full, "utf-8");
            const lines = text.split("\n");
            for (let i = 0; i < lines.length; i++) {
              if (re.test(lines[i])) {
                hits.push({
                  file: path26.relative(s.workspace, full),
                  line: i + 1,
                  text: lines[i].slice(0, 400),
                  before: i > 0 ? lines[i - 1].slice(0, 400) : void 0,
                  after: i < lines.length - 1 ? lines[i + 1].slice(0, 400) : void 0
                });
                if (hits.length >= maxHits) return;
              }
            }
          } catch {
          }
        }
      }
    };
    await walk2(s.workspace);
    sendJson(c.res, 200, { ready: true, hits, scanned, truncated: hits.length >= maxHits });
  });
  r.get("/api/semantic-search", async (c) => {
    const q = c.query.q ?? "";
    const k = Math.min(20, Number(c.query.k ?? 10));
    if (!s.index) return sendJson(c.res, 200, { ready: false, hits: [] });
    if (s.index.vectors.size() === 0)
      return sendJson(c.res, 200, { ready: true, hits: [], note: "no vectors" });
    const [v] = await s.embedder.embed([q]);
    const hits = s.index.vectors.search(v, k);
    sendJson(c.res, 200, { ready: true, hits, embedder: s.embedder.name });
  });
  r.get("/api/hybrid-search", async (c) => {
    const q = c.query.q ?? "";
    const k = Math.min(20, Number(c.query.k ?? 10));
    if (!s.index) return sendJson(c.res, 200, { ready: false, hits: [] });
    const hits = await hybridRetrieve(s.index, s.embedder, q, k, s.reranker);
    sendJson(c.res, 200, { ready: true, hits });
  });
  r.get("/api/symbols", (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false });
    const q = (c.query.q ?? "").trim();
    const filePath = c.query.path ?? null;
    if (filePath) return sendJson(c.res, 200, { ready: true, symbols: s.index.symbols.symbolsInFile(filePath) });
    if (!q) return sendJson(c.res, 200, { ready: true, symbols: [] });
    sendJson(c.res, 200, { ready: true, symbols: s.index.symbols.fuzzyFind(q, 30) });
  });
  r.get("/api/files/all", (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false, files: [] });
    const q = (c.query.q ?? "").trim().toLowerCase();
    const all = s.index.symbols.allFiles();
    if (!q) return sendJson(c.res, 200, { ready: true, files: all.slice(0, 200) });
    const score = (p) => {
      const lp = p.toLowerCase();
      let i = 0, j = 0, gaps = 0, lastHit = -1;
      while (i < q.length && j < lp.length) {
        if (q[i] === lp[j]) {
          if (lastHit !== -1 && j - lastHit > 1) gaps += j - lastHit;
          lastHit = j;
          i++;
        }
        j++;
      }
      if (i < q.length) return -1;
      const base = lp.split("/").pop() ?? lp;
      const baseHit = base.includes(q) ? 100 : 0;
      return baseHit + 1e3 - gaps - lp.length;
    };
    const ranked = all.map((p) => ({ p, s: score(p) })).filter((x) => x.s >= 0).sort((a, b) => b.s - a.s).slice(0, 50).map((x) => x.p);
    sendJson(c.res, 200, { ready: true, files: ranked });
  });
  r.get("/api/references", (c) => {
    if (!s.index) return sendJson(c.res, 200, { ready: false });
    const name = (c.query.name ?? "").trim();
    if (!name) return sendJson(c.res, 200, { ready: true, refs: [] });
    sendJson(c.res, 200, { ready: true, refs: s.index.symbols.findReferences(name) });
  });
  r.post("/api/complete", async (c) => {
    const body = await readBody(c.req);
    const { path: filePath, prefix = "", suffix = "", language = "typescript", maxTokens = 80 } = body ?? {};
    const PRE_LIMIT = 2e3, SUF_LIMIT = 600;
    const pre = prefix.length > PRE_LIMIT ? prefix.slice(prefix.length - PRE_LIMIT) : prefix;
    const suf = suffix.length > SUF_LIMIT ? suffix.slice(0, SUF_LIMIT) : suffix;
    const queryText = (pre.slice(-200) + " " + suf.slice(0, 100)).trim();
    let snippets = "";
    if (s.index && queryText) {
      try {
        const hits = await hybridRetrieve(s.index, s.embedder, queryText, 3, s.reranker);
        snippets = hits.filter((h) => h.path !== filePath).slice(0, 3).map((h) => `// ${h.path}:${h.startLine}-${h.endLine}
${h.text.slice(0, 400)}`).join("\n\n");
      } catch {
      }
    }
    const sys = `You are an expert code completion engine. Given the code BEFORE the cursor and the code AFTER the cursor, output ONLY the text that should be inserted at the cursor \u2014 no explanations, no markdown fences, no leading newline. Keep the completion short (a single statement, expression, or up to a few lines). Match the existing style and indentation. If nothing useful to add, output an empty string.`;
    const user = [
      snippets ? `### Related context
${snippets}
` : "",
      `### File: ${filePath ?? "<unknown>"} (${language})`,
      `### Code before cursor`,
      "```",
      pre,
      "```",
      `### Code after cursor`,
      "```",
      suf,
      "```",
      `### Completion to insert at <CURSOR>`
    ].filter(Boolean).join("\n");
    try {
      let full = "";
      const ctl = new AbortController();
      c.req.on("close", () => ctl.abort());
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: "system", content: sys }, { role: "user", content: user }],
        { temperature: 0.1, signal: ctl.signal }
      )) {
        if (chunk.delta) full += chunk.delta;
        if (full.length > maxTokens * 6) break;
      }
      const out = full.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").replace(/^\n+/, "");
      sendJson(c.res, 200, { completion: out });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/inline-edit", async (c) => {
    const body = await readBody(c.req);
    const {
      path: filePath,
      selection = "",
      instruction = "",
      language = "typescript",
      contextBefore = "",
      contextAfter = "",
      apply = false,
      fullText
    } = body ?? {};
    const sse = openSse(c.req, c.res);
    const sys = "You are an inline code editor. Given the code BEFORE the selection, the SELECTION itself, the code AFTER the selection, and the user instruction, output ONLY the rewritten selection. No explanations, no markdown fences, no leading or trailing newlines. Preserve indentation style and surrounding context. If the instruction is unclear, output the selection unchanged.";
    const user = [
      `### File: ${filePath ?? "<unknown>"} (${language})`,
      contextBefore ? `### Code BEFORE selection
\`\`\`
${contextBefore.slice(-1500)}
\`\`\`` : "",
      `### Original SELECTION
\`\`\`
${selection}
\`\`\``,
      contextAfter ? `### Code AFTER selection
\`\`\`
${contextAfter.slice(0, 800)}
\`\`\`` : "",
      `### Instruction
${instruction}`,
      "### Rewritten SELECTION"
    ].filter(Boolean).join("\n");
    let full = "";
    try {
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: "system", content: sys }, { role: "user", content: user }],
        { temperature: 0.2, signal: sse.signal }
      )) {
        if (chunk.delta) {
          full += chunk.delta;
          sse.send({ type: "text", text: chunk.delta });
        }
        if (chunk.done || chunk.finishReason) break;
      }
      const cleaned = full.replace(/^```[a-zA-Z]*\n?/, "").replace(/```\s*$/, "").replace(/^\n+/, "").replace(/\n+$/, "");
      let pendingEditId;
      if (apply && filePath && typeof fullText === "string" && selection) {
        const idx = fullText.indexOf(selection);
        if (idx >= 0) {
          const newContent = fullText.slice(0, idx) + cleaned + fullText.slice(idx + selection.length);
          const edit = await s.pendingEdits.propose({ path: filePath, newContent, tool: "inline-edit" });
          pendingEditId = edit.id;
        }
      }
      sse.send({ type: "done", newSelection: cleaned, pendingEditId });
    } catch (e) {
      sse.send({ type: "error", error: e?.message ?? String(e) });
    } finally {
      sse.end();
    }
  });
  r.get("/api/memory", async (c) => sendJson(c.res, 200, {
    user: await s.memory.list("user"),
    project: await s.memory.list("project")
  }));
  r.post("/api/memory", async (c) => {
    const body = await readBody(c.req);
    sendJson(c.res, 200, await s.memory.upsert(body?.scope ?? "user", body));
  });
  r.delete("/api/memory/:scope/:id", async (c) => {
    sendJson(c.res, 200, { ok: await s.memory.delete(c.params.scope, c.params.id) });
  });
  r.post("/api/memory/maintain", async (c) => {
    try {
      const body = await readBody(c.req);
      sendJson(c.res, 200, { ok: true, report: await s.memory.maintain(body ?? {}) });
    } catch (e) {
      sendJson(c.res, 500, { ok: false, error: e?.message ?? String(e) });
    }
  });
  r.post("/api/recent-activity", async (c) => {
    const body = await readBody(c.req);
    const { sessionId, kind, target, meta } = body ?? {};
    if (!sessionId || !kind || !target) return sendJson(c.res, 400, { error: "sessionId, kind, target required" });
    if (!["edit", "read", "search", "view"].includes(kind)) return sendJson(c.res, 400, { error: "invalid kind" });
    s.recentActivity.record(sessionId, { kind, target, meta });
    sendJson(c.res, 200, { ok: true });
  });
  r.post("/api/judge", async (c) => {
    try {
      const { z } = await Promise.resolve().then(() => (init_zod(), zod_exports));
      const body = await readBody(c.req) ?? {};
      const question = String(body.question ?? "").trim();
      const answer = String(body.answer ?? "");
      const expectedConcepts = Array.isArray(body.expectedConcepts) ? body.expectedConcepts : [];
      const context = typeof body.context === "string" ? body.context : "";
      const passThreshold = Number(body.passThreshold ?? 7);
      if (!question) return sendJson(c.res, 400, { error: "question required" });
      const schema = z.object({
        score: z.number().min(0).max(10),
        pass: z.boolean(),
        reasoning: z.string().min(1),
        missing: z.array(z.string()).optional()
      });
      const system = "You are a strict but fair evaluator of code-assistant outputs. Score from 0 to 10 based on how well the answer addresses the question. Do NOT reward fluff or hedging. Do NOT reward correct-but-irrelevant content. Score >= 7 means the answer is acceptable for production use.";
      const conceptsBlock = expectedConcepts.length ? `

Expected concepts to cover (each missing concept reduces score):
${expectedConcepts.map((x) => "  - " + x).join("\n")}` : "";
      const ctxBlock = context ? `

Reference context:
${context}` : "";
      const user = `Question: ${question}

Answer to evaluate:
"""
${answer.trim() || "(empty)"}
"""` + conceptsBlock + ctxBlock;
      const result = await callStructured(s.llmFast, {
        schema,
        messages: [{ role: "system", content: system }, { role: "user", content: user }],
        schemaName: "judge_output",
        temperature: 0,
        maxRetries: 1
      });
      const expected = result.data.score >= passThreshold;
      sendJson(c.res, 200, { ...result.data, pass: expected, threshold: passThreshold, attempts: result.attempts });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  let diagCache = {
    ts: 0,
    running: false,
    result: []
  };
  const DIAG_TTL_MS = 3e4;
  async function runDiagnostics() {
    if (diagCache.running) return diagCache.result;
    diagCache.running = true;
    const t0 = Date.now();
    try {
      const { exec: exec2 } = await import("node:child_process");
      const hasPnpm = await fs23.access(path26.join(s.workspace, "pnpm-workspace.yaml")).then(() => true).catch(() => false);
      const pkgJson = await fs23.readFile(path26.join(s.workspace, "package.json"), "utf-8").catch(() => "{}");
      const scripts = JSON.parse(pkgJson).scripts ?? {};
      let cmd;
      if (hasPnpm && scripts.typecheck) cmd = "pnpm -r typecheck";
      else if (scripts.typecheck) cmd = "npm run typecheck";
      else cmd = "npx tsc --noEmit";
      const result = await new Promise((resolve3) => {
        const p = exec2(
          cmd,
          { cwd: s.workspace, maxBuffer: 8 * 1024 * 1024, timeout: 12e4 },
          (_e, so, se) => resolve3({ out: (so ?? "") + "\n" + (se ?? "") })
        );
        p.on?.("error", () => void 0);
      });
      const diagnostics = [];
      const tscRe = /(.+?)\((\d+),(\d+)\):\s*(error|warning)\s+(TS\d+):\s*(.+)/g;
      for (const m of result.out.matchAll(tscRe)) {
        let file = m[1];
        if (path26.isAbsolute(file)) file = path26.relative(s.workspace, file);
        diagnostics.push({
          file,
          line: Number(m[2]),
          col: Number(m[3]),
          severity: m[4],
          message: m[6].slice(0, 300),
          code: m[5]
        });
        if (diagnostics.length >= 200) break;
      }
      diagCache = { ts: Date.now(), running: false, result: diagnostics, durationMs: Date.now() - t0 };
    } catch (e) {
      diagCache = { ts: Date.now(), running: false, result: [], lastError: e?.message ?? String(e), durationMs: Date.now() - t0 };
    }
    return diagCache.result;
  }
  r.get("/api/diagnostics", async (c) => {
    const force = c.query.force === "1" || c.query.force === "true";
    const stale = Date.now() - diagCache.ts > DIAG_TTL_MS;
    if (force || stale && !diagCache.running) runDiagnostics().catch(() => void 0);
    sendJson(c.res, 200, {
      diagnostics: diagCache.result,
      ts: diagCache.ts,
      running: diagCache.running,
      durationMs: diagCache.durationMs,
      error: diagCache.lastError,
      stale
    });
  });
  r.get("/api/edits", (c) => sendJson(c.res, 200, s.pendingEdits.list()));
  r.post("/api/edits", async (c) => {
    const body = await readBody(c.req);
    const { path: p, newContent, tool = "manual" } = body ?? {};
    if (!p || typeof newContent !== "string") return sendJson(c.res, 400, { error: "path and newContent required" });
    sendJson(c.res, 200, await s.pendingEdits.propose({ path: p, newContent, tool }));
  });
  r.get("/api/edits/:id", (c) => {
    const e = s.pendingEdits.get(c.params.id);
    if (!e) return sendJson(c.res, 404, { error: "not found" });
    sendJson(c.res, 200, e);
  });
  r.post("/api/edits/:id/accept", async (c) => {
    try {
      sendJson(c.res, 200, await s.pendingEdits.accept(c.params.id));
    } catch (e) {
      sendJson(c.res, 400, { error: e.message });
    }
  });
  r.post("/api/edits/:id/reject", (c) => {
    try {
      sendJson(c.res, 200, s.pendingEdits.reject(c.params.id));
    } catch (e) {
      sendJson(c.res, 400, { error: e.message });
    }
  });
  r.post("/api/edits/accept-all", async (c) => sendJson(c.res, 200, await s.pendingEdits.acceptAll()));
  r.post("/api/edits/reject-all", (c) => {
    const all = s.pendingEdits.list();
    sendJson(c.res, 200, all.map((e) => s.pendingEdits.reject(e.id)));
  });
  r.get("/api/checkpoints", (c) => sendJson(
    c.res,
    200,
    s.checkpoints.list().map((cp) => ({
      id: cp.id,
      label: cp.label,
      trigger: cp.trigger,
      createdAt: cp.createdAt,
      reverted: cp.reverted,
      fileCount: cp.files.length,
      files: cp.files.map((f) => f.path)
    }))
  ));
  r.get("/api/checkpoints/:id", (c) => {
    const cp = s.checkpoints.get(c.params.id);
    if (!cp) return sendJson(c.res, 404, { error: "not found" });
    sendJson(c.res, 200, cp);
  });
  r.post("/api/checkpoints/:id/revert", async (c) => {
    try {
      sendJson(c.res, 200, await s.checkpoints.revert(c.params.id));
    } catch (e) {
      sendJson(c.res, 400, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/rules", (c) => sendJson(
    c.res,
    200,
    s.rules.list().map((rl) => ({ file: rl.file, name: rl.name, mode: rl.mode, globs: rl.globs, description: rl.description, length: rl.body.length }))
  ));
  r.post("/api/rules/reload", async (c) => {
    await s.rules.load();
    sendJson(c.res, 200, { ok: true, count: s.rules.list().length });
  });
  r.get("/api/project-memory", (c) => sendJson(
    c.res,
    200,
    s.projectMemory.list().map((m) => ({ path: m.path, scope: m.scope, depth: m.depth, bytes: m.body.length }))
  ));
  r.post("/api/project-memory/reload", async (c) => {
    await s.projectMemory.load();
    sendJson(c.res, 200, { ok: true, count: s.projectMemory.list().length });
  });
  r.get("/api/slash", (c) => sendJson(
    c.res,
    200,
    s.slash.list().map((cmd) => ({ name: cmd.name, description: cmd.description, source: cmd.source }))
  ));
  r.post("/api/slash/reload", async (c) => {
    await s.slash.loadUser();
    sendJson(c.res, 200, { ok: true, count: s.slash.list().length });
  });
  r.get("/api/providers", (c) => sendJson(c.res, 200, s.providers.list()));
  r.get("/api/providers/raw", (c) => {
    const cfg = s.providers.getConfig();
    sendJson(c.res, 200, cfg);
  });
  r.post("/api/providers", async (c) => {
    try {
      const body = await readBody(c.req);
      if (!body?.name || typeof body.baseUrl !== "string") return sendJson(c.res, 400, { error: "name and baseUrl required" });
      sendJson(c.res, 200, await s.providers.upsert(body));
    } catch (e) {
      sendJson(c.res, 400, { error: e?.message ?? String(e) });
    }
  });
  r.delete("/api/providers/:id", async (c) => {
    try {
      await s.providers.remove(c.params.id);
      sendJson(c.res, 200, { ok: true });
    } catch (e) {
      sendJson(c.res, 400, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/providers/active", async (c) => {
    try {
      const body = await readBody(c.req);
      if (!body?.role) return sendJson(c.res, 400, { error: "role required" });
      await s.providers.setActive(body.role, body.id);
      sendJson(c.res, 200, s.providers.list());
    } catch (e) {
      sendJson(c.res, 400, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/providers/fallbacks", async (c) => {
    try {
      const body = await readBody(c.req);
      if (!body?.role || !Array.isArray(body.ids)) return sendJson(c.res, 400, { error: "role and ids required" });
      await s.providers.setFallbacks(body.role, body.ids);
      sendJson(c.res, 200, s.providers.list());
    } catch (e) {
      sendJson(c.res, 400, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/providers/test", async (c) => {
    try {
      const body = await readBody(c.req);
      const profile = s.providers.get(body.id);
      if (!profile) return sendJson(c.res, 404, { error: "profile not found" });
      const provider = createProvider(profile);
      const t0 = Date.now();
      let first = 0;
      let text = "";
      for await (const chunk of provider.chatStream(
        [{ role: "user", content: "Reply with exactly: OK" }],
        { temperature: 0, model: profile.model }
      )) {
        if (chunk.delta) {
          if (!first) first = Date.now() - t0;
          text += chunk.delta;
          if (text.length > 32) break;
        }
        if (chunk.done) break;
      }
      sendJson(c.res, 200, { ok: true, firstTokenMs: first, totalMs: Date.now() - t0, sample: text.slice(0, 64) });
    } catch (e) {
      sendJson(c.res, 500, { ok: false, error: e?.message ?? String(e) });
    }
  });
  r.get("/api/sessions", (c) => {
    const url = new URL(c.req.url ?? "/", "http://x");
    const mode = url.searchParams.get("mode");
    const ws = url.searchParams.get("workspace");
    const remote = url.searchParams.get("remote");
    let list = s.sessions.list();
    if (mode) list = list.filter((x) => (x.mode ?? "code") === mode);
    if (ws) list = list.filter((x) => x.workspaceRoot === ws);
    if (remote === "true") list = list.filter((x) => !!x.remoteUser);
    if (remote === "false") list = list.filter((x) => !x.remoteUser);
    sendJson(c.res, 200, list);
  });
  r.get("/api/sessions/:id", (c) => {
    const sess = s.sessions.get(c.params.id);
    if (!sess) return sendJson(c.res, 404, { error: "not found" });
    sendJson(c.res, 200, { meta: sess.meta, messages: sess.messages });
  });
  r.post("/api/sessions", async (c) => {
    const body = await readBody(c.req);
    const mode = body?.mode === "work" ? "work" : body?.mode === "code" ? "code" : void 0;
    const workspaceRoot = mode === "code" ? body?.workspaceRoot ?? s.workspace : body?.workspaceRoot;
    sendJson(
      c.res,
      200,
      await s.sessions.create({
        title: body?.title,
        mode,
        workspaceRoot,
        remoteUser: body?.remoteUser
      })
    );
  });
  r.patch("/api/sessions/:id", async (c) => {
    try {
      const body = await readBody(c.req);
      sendJson(c.res, 200, await s.sessions.rename(c.params.id, String(body?.title ?? "")));
    } catch (e) {
      sendJson(c.res, 404, { error: e?.message ?? String(e) });
    }
  });
  r.delete("/api/sessions/:id", async (c) => {
    await s.sessions.delete(c.params.id);
    sendJson(c.res, 200, { ok: true });
  });
  r.post("/api/sessions/:id/fork", async (c) => {
    try {
      const body = await readBody(c.req);
      sendJson(c.res, 200, await s.sessions.fork(c.params.id, Number(body?.untilIndex ?? -1), body?.title));
    } catch (e) {
      sendJson(c.res, 400, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/sessions/:id/resume-info", (c) => {
    const sess = s.sessions.get(c.params.id);
    if (!sess) return sendJson(c.res, 404, { error: "not found" });
    const it = sess.meta.interruptedTurn;
    if (!it) return sendJson(c.res, 200, { interrupted: false });
    const hint = `[RESUME] \u4E0A\u4E00\u6B21\u5BF9\u8BDD\u5728\u6267\u884C\u4E2D\u88AB\u4E2D\u65AD\u3002\u4F60\u5DF2\u7ECF\u8F93\u51FA\u4E86\u4EE5\u4E0B\u90E8\u5206\u5185\u5BB9\uFF1A

----- \u5DF2\u8F93\u51FA\uFF08\u622A\u65AD\uFF09-----
${it.partialAssistant.slice(-2e3)}
----- \u5DF2\u8F93\u51FA\u7ED3\u675F -----

\u539F\u59CB\u4EFB\u52A1\uFF1A"${it.userMessage}"

\u8BF7\u7EE7\u7EED\u5B8C\u6210\u8FD9\u4E2A\u4EFB\u52A1\u3002`;
    sendJson(c.res, 200, {
      interrupted: true,
      turnId: it.turnId,
      originalUserMessage: it.userMessage,
      partialAssistant: it.partialAssistant,
      startedAt: it.startedAt,
      suggestedResumePrompt: hint,
      history: sess.messages
    });
  });
  r.post("/api/sessions/:id/resume-discard", async (c) => {
    const sess = s.sessions.get(c.params.id);
    if (!sess) return sendJson(c.res, 404, { error: "not found" });
    if (sess.meta.interruptedTurn) {
      await s.sessions.interruptTurn(c.params.id, sess.meta.interruptedTurn.turnId, "user_discard").catch(() => void 0);
      sess.meta.interruptedTurn = void 0;
    }
    sendJson(c.res, 200, { ok: true });
  });
  r.post("/api/remote/sessions", async (c) => {
    try {
      const body = await readBody(c.req);
      const wxUserId = String(body?.wxUserId ?? "").trim();
      if (!wxUserId) return sendJson(c.res, 400, { error: "wxUserId required" });
      const meta = await s.sessions.findOrCreateForRemote(wxUserId, {
        title: body?.title,
        workspace: body?.workspace ?? s.workspace
      });
      sendJson(c.res, 200, meta);
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/remote/sessions", (c) => {
    const url = new URL(c.req.url ?? "/", "http://x");
    const wxUserId = url.searchParams.get("wxUserId");
    let list = s.sessions.list().filter((x) => !!x.remoteUser);
    if (wxUserId) list = list.filter((x) => x.remoteUser === wxUserId);
    sendJson(c.res, 200, list);
  });
  r.get("/api/skills", (c) => sendJson(
    c.res,
    200,
    s.skills.list().map((sk) => ({ name: sk.name, description: sk.description, source: sk.source, userInvocable: sk.userInvocable, triggers: sk.triggers }))
  ));
  r.get("/api/skills/:name", async (c) => {
    const f = await s.skills.loadFull(c.params.name);
    if (!f) return sendJson(c.res, 404, { error: "not found" });
    sendJson(c.res, 200, {
      name: f.name,
      description: f.description,
      source: f.source,
      directory: f.directory,
      supportFiles: f.supportFiles,
      body: f.body
    });
  });
  r.post("/api/skills/reload", async (c) => {
    await s.skills.load();
    sendJson(c.res, 200, { ok: true, count: s.skills.list().length });
  });
  r.get("/api/mcp/status", (c) => {
    const mgr = s.mcpManager;
    if (!mgr) return sendJson(c.res, 200, { servers: [] });
    sendJson(c.res, 200, {
      servers: mgr.list().map((cl) => ({
        name: cl.name,
        connected: cl.connected,
        tools: cl.tools.map((t) => t.name)
      }))
    });
  });
  r.get("/api/mcp/config", async (c) => {
    try {
      const cfgPath = path26.join(s.workspace, ".minicodeide", "mcp.json");
      let raw = "";
      let exists = false;
      try {
        raw = await fs23.readFile(cfgPath, "utf-8");
        exists = true;
      } catch {
        try {
          const ex = path26.join(s.workspace, ".minicodeide", "mcp.example.json");
          raw = await fs23.readFile(ex, "utf-8");
        } catch {
          raw = JSON.stringify({ servers: {} }, null, 2);
        }
      }
      sendJson(c.res, 200, { exists, content: raw, path: cfgPath });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.put("/api/mcp/config", async (c) => {
    try {
      const body = await readBody(c.req);
      const content = body?.content ?? "";
      try {
        JSON.parse(content);
      } catch (e) {
        return sendJson(c.res, 400, { error: `invalid JSON: ${e?.message}` });
      }
      const dir = path26.join(s.workspace, ".minicodeide");
      await fs23.mkdir(dir, { recursive: true });
      const cfgPath = path26.join(dir, "mcp.json");
      await fs23.writeFile(cfgPath, content, "utf-8");
      sendJson(c.res, 200, { ok: true, path: cfgPath, hint: "Restart server to apply MCP changes (or POST /api/mcp/reconnect)." });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/mcp/reconnect", async (c) => {
    try {
      const mgr = s.mcpManager;
      if (!mgr) return sendJson(c.res, 200, { ok: true, results: [], hint: "MCP not initialized" });
      await mgr.closeAll();
      const results = await mgr.loadAndConnect();
      mgr.registerToolsTo(s.registry);
      sendJson(c.res, 200, { ok: true, results });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/subagents", (c) => sendJson(c.res, 200, s.subagents.list(c.query.parent || void 0)));
  r.get("/api/mentions/suggest", async (c) => {
    const q = c.query.q ?? "";
    const m = q.match(/^(file|symbol|docs|selection|web):(.*)$/);
    if (!m) return sendJson(c.res, 200, { items: [] });
    const kind = m[1];
    const arg = m[2].toLowerCase();
    const items = [];
    try {
      if (kind === "file" || kind === "selection") {
        if (s.index) {
          const collected = [];
          for (const p of s.index.symbols.allFiles()) {
            if (!arg) collected.push({ path: p, score: 0 });
            else {
              const idx = p.toLowerCase().indexOf(arg);
              if (idx >= 0) {
                const base = p.split("/").pop().toLowerCase();
                const inBase = base.includes(arg) ? 1e3 : 0;
                collected.push({ path: p, score: inBase + -idx + -Math.min(p.length, 100) });
              }
            }
          }
          collected.sort((a, b) => b.score - a.score);
          for (const cc of collected.slice(0, 20))
            items.push({ kind, label: cc.path, insert: `@${kind}:${cc.path}` });
        }
      } else if (kind === "symbol") {
        if (s.index)
          for (const sym of s.index.symbols.fuzzyFind(arg, 20))
            items.push({ kind, label: `${sym.name} \xB7 ${sym.path}:${sym.startLine}`, insert: `@symbol:${sym.name}`, hint: sym.kind });
      } else if (kind === "docs") {
        try {
          const dir = path26.join(s.workspace, "docs");
          for (const f of await fs23.readdir(dir)) {
            if (!f.endsWith(".md")) continue;
            const name = f.replace(/\.md$/, "");
            if (!arg || name.toLowerCase().includes(arg))
              items.push({ kind, label: `docs/${f}`, insert: `@docs:${name}` });
          }
        } catch {
        }
      }
    } catch (e) {
      return sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
    sendJson(c.res, 200, { items: items.slice(0, 30) });
  });
  r.get("/api/git/status", async (c) => {
    if (!await isGitRepo(s.workspace)) return sendJson(c.res, 200, { isRepo: false });
    try {
      const [status, branch] = await Promise.all([gitStatus(s.workspace), gitBranch(s.workspace)]);
      sendJson(c.res, 200, { isRepo: true, branch, files: status });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/git/diff", async (c) => {
    if (!await isGitRepo(s.workspace)) return sendJson(c.res, 200, { isRepo: false, diff: "" });
    try {
      const diff = await gitDiff(s.workspace, { path: c.query.path || void 0, staged: c.query.staged === "1" });
      sendText(c.res, 200, diff);
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.get("/api/git/log", async (c) => {
    if (!await isGitRepo(s.workspace)) return sendJson(c.res, 200, []);
    try {
      const n = Math.min(Number(c.query.n ?? 20), 100);
      sendJson(c.res, 200, await gitLog(s.workspace, n));
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/git/generate-message", async (c) => {
    if (!await isGitRepo(s.workspace)) return sendJson(c.res, 400, { error: "not a git repo" });
    const body = await readBody(c.req);
    const paths = body?.paths ?? [];
    try {
      let diff = "";
      if (paths.length) for (const p of paths) diff += await gitDiff(s.workspace, { path: p });
      else diff = await gitDiff(s.workspace, { staged: true }) + "\n" + await gitDiff(s.workspace, {});
      if (!diff.trim()) return sendJson(c.res, 200, { message: "", reason: "no changes detected" });
      const truncated = diff.length > 12e3 ? diff.slice(0, 12e3) + "\n... (truncated)" : diff;
      const sys = 'You are a commit message generator. Given a unified diff, write ONE conventional commit message:\n  - First line: <type>(<scope>): <subject> (<= 72 chars; type \u2208 feat|fix|docs|refactor|chore|test|perf|style|ci)\n  - Optional body: 2-5 bullet lines starting with "- " explaining what & why (not how)\nNo fences, no quotes, no extra prose. Output ONLY the message.';
      let out = "";
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: "system", content: sys }, { role: "user", content: "### Diff\n" + truncated }],
        { temperature: 0.2 }
      )) {
        if (chunk.delta) out += chunk.delta;
        if (chunk.done || chunk.finishReason) break;
      }
      sendJson(c.res, 200, { message: out.trim() });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/git/commit", async (c) => {
    if (!await isGitRepo(s.workspace)) return sendJson(c.res, 400, { error: "not a git repo" });
    const body = await readBody(c.req);
    const { message, paths = [] } = body;
    if (!message?.trim()) return sendJson(c.res, 400, { error: "message required" });
    try {
      sendJson(c.res, 200, { ok: true, ...await gitCommit(s.workspace, message, paths) });
    } catch (e) {
      sendJson(c.res, 500, { error: e?.message ?? String(e) });
    }
  });
  r.post("/api/chat", async (c) => {
    const body = await readBody(c.req, { limit: 10 * 1024 * 1024 }) ?? {};
    const {
      messages = [],
      userMessage: rawUserMessage,
      mode = "agent",
      sessionId: rawSessionId,
      images = [],
      timeout: clientTimeout
    } = body;
    const persistSession = rawSessionId && s.sessions.get(rawSessionId);
    const chatSessionId = rawSessionId || `anon:${c.req.headers["x-forwarded-for"] ?? c.req.socket.remoteAddress ?? "local"}`;
    let userMessage = rawUserMessage;
    let slashName = null;
    const slashed = s.slash.maybeExpand(rawUserMessage);
    if (slashed) {
      userMessage = slashed.expanded;
      slashName = slashed.command;
    }
    const manualRules = [];
    userMessage = userMessage.replace(/@rule:([\w-]+)/g, (_m, n) => {
      manualRules.push(n);
      return "";
    }).trim();
    const explicitSkills = [];
    userMessage = userMessage.replace(/\/skill:([\w-]+)/g, (_m, n) => {
      explicitSkills.push(n);
      return "";
    }).trim();
    const mentionResult = await parseMentions(userMessage, { workspace: s.workspace, index: s.index });
    userMessage = mentionResult.cleanText || userMessage;
    const explicitContext = mentionResult.items;
    const sse = openSse(c.req, c.res);
    if (slashName) sse.send({ type: "slash", command: slashName });
    if (explicitSkills.length) sse.send({ type: "skills_activated", skills: explicitSkills });
    if (mentionResult.items.length || mentionResult.unresolved.length) {
      sse.send({
        type: "mentions",
        resolved: mentionResult.items.map((i) => ({ type: i.type, label: i.label })),
        unresolved: mentionResult.unresolved
      });
    }
    for (const it of mentionResult.items)
      if (it.type === "file" && it.label)
        s.recentActivity.record(chatSessionId, { kind: "view", target: it.label });
    let currentTurnId = null;
    if (persistSession) {
      await s.sessions.append(rawSessionId, { role: "user", content: rawUserMessage ?? "" }).catch(() => void 0);
      currentTurnId = await s.sessions.startTurn(rawSessionId, rawUserMessage ?? "").catch(() => null);
    }
    let assistantBuf = "";
    let userAbort = false;
    let agentDoneReason = "completed";
    const autoCtx = s.index ? (await hybridRetrieve(s.index, s.embedder, userMessage, 6, s.reranker)).map((h) => ({
      file: `${h.path}:${h.startLine}-${h.endLine}`,
      text: h.text
    })) : [];
    if (autoCtx.length) {
      sse.send({
        type: "retrieval",
        query: userMessage.slice(0, 200),
        hits: autoCtx.map((cc, i) => ({ rank: i + 1, file: cc.file }))
      });
    }
    for (const cc of autoCtx.slice(0, 3)) {
      const f = cc.file.split(":")[0];
      if (f) s.recentActivity.record(chatSessionId, { kind: "read", target: f });
    }
    const touched = autoCtx.map((cc) => cc.file.split(":")[0]);
    const activeRules = s.rules.pickForRequest({ userMessage, touchedPaths: touched, manual: manualRules });
    const ruleExtra = s.rules.renderForSystem(activeRules);
    if (activeRules.length) sse.send({ type: "rules", activated: activeRules.map((rl) => rl.name) });
    const chatProfile = s.providers.getActive("chat");
    const chatModel = chatProfile?.model;
    const llmSummarize = async (middle) => {
      const sys = "You are a compaction assistant. Summarize the following conversation excerpt for context preservation.\nPreserve: file paths, commands, errors, decisions, TODOs, open questions.\nDo NOT copy raw tool outputs or large logs. Output a concise paragraph (max 400 tokens).";
      const userBlock = middle.map((m) => `[${m.role}] ${(m.content ?? "").toString().slice(0, 1e3)}`).join("\n");
      let out = "";
      for await (const chunk of s.llmComplete.chatStream(
        [{ role: "system", content: sys }, { role: "user", content: userBlock }],
        { model: s.providers.getActive("complete")?.model }
      )) {
        if (chunk.delta) out += chunk.delta;
        if (chunk.done || chunk.finishReason) break;
      }
      return out.trim() || "(empty summary)";
    };
    const initial = await buildMessages({
      userMessage,
      history: messages,
      autoContext: autoCtx,
      explicitContext,
      memory: s.memory,
      meta: { cwd: s.workspace, os: `${os4.platform()} ${os4.release()}` },
      images,
      systemExtras: [
        s.projectMemory.renderForSystem(),
        s.skills.renderForSystem(),
        ...(await Promise.all(
          explicitSkills.map(async (name) => {
            const f = await s.skills.loadFull(name);
            if (!f) return `[Skill "${name}" not found]`;
            const body2 = f.body?.slice(0, 4e3) ?? "(empty)";
            return `\u2500\u2500\u2500 Skill: ${f.name} (explicitly selected by user) \u2500\u2500\u2500
${body2}`;
          })
        )).filter(Boolean),
        ruleExtra,
        detectMultiStepHint(userMessage),
        s.recentActivity.render(chatSessionId)
      ].filter(Boolean),
      providerFlavor: chatProfile?.kind === "anthropic" ? "anthropic" : chatProfile?.kind === "openai" ? "openai" : /gemini/i.test(chatProfile?.model ?? "") ? "gemini" : "generic",
      injectionCache: s.injectionCache,
      sessionId: chatSessionId,
      compaction: { model: chatModel, summarize: llmSummarize },
      onMemoryRecalled: (items) => {
        if (items.length) sse.send({ type: "memory_recalled", items });
      }
    });
    const compactDbg = initial.__compactDebug;
    if (compactDbg) sse.send({ type: "context_stats", ...compactDbg });
    try {
      const abort = new AbortController();
      c.req.on("close", () => {
        userAbort = true;
        abort.abort();
      });
      const llmRouted = s.buildLlmFor("chat", (info) => sse.send({ type: "provider_switch", ...info }));
      if (mode === "ask") {
        const noToolRegistry = new ToolRegistry();
        for await (const ev of runAgent({
          llm: llmRouted,
          registry: noToolRegistry,
          messages: initial,
          toolCtx: { cwd: s.workspace },
          signal: abort.signal,
          maxSteps: 1,
          llmTimeout: clientTimeout
        })) {
          if (ev.type === "text" && ev.text) {
            assistantBuf += ev.text;
            if (persistSession && currentTurnId)
              s.sessions.appendChunk(rawSessionId, currentTurnId, ev.text).catch(() => void 0);
          }
          if (ev.type === "done" && ev.reason) agentDoneReason = ev.reason;
          sse.send(ev);
        }
      } else {
        for await (const ev of runAgent({
          llm: llmRouted,
          registry: s.registry,
          messages: initial,
          toolCtx: {
            cwd: s.workspace,
            approve: async (info) => {
              const id = `appr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
              const p = new Promise((resolve3) => {
                s.approvals.waiting.set(id, { id, cmd: info.tool, ts: Date.now(), resolver: resolve3 });
              });
              sse.send({ type: "approve_request", id, tool: info.tool, args: info.args });
              return await p === "allow";
            },
            execPolicy: (cmd) => decideCommand(cmd),
            proposeEdit: async (req) => {
              const e = await s.pendingEdits.propose(req);
              sse.send({ type: "pending_edit", edit: e });
              return { id: e.id };
            },
            virtualRead: (p) => s.pendingEdits.virtualRead(p),
            updatePlan: (plan) => sse.send({ type: "plan", plan }),
            codeIntel: {
              findSymbol: async (q, limit) => s.index ? s.index.symbols.fuzzyFind(q, limit ?? 15) : [],
              findReferences: async (name) => s.index ? s.index.symbols.findReferences(name) : [],
              semanticSearch: async (q, k) => s.index ? hybridRetrieve(s.index, s.embedder, q, k ?? 8, s.reranker) : [],
              listFileSymbols: async (p) => s.index ? s.index.symbols.symbolsInFile(p) : []
            },
            skills: {
              list: () => s.skills.list().map((sk) => ({ name: sk.name, description: sk.description, source: sk.source })),
              loadFull: async (name) => {
                const f = await s.skills.loadFull(name);
                if (!f) return null;
                return { name: f.name, description: f.description, body: f.body, directory: f.directory, supportFiles: f.supportFiles };
              }
            },
            subagentDepth: 0,
            dispatchSubagent: async (req) => {
              const rr = await s.subagents.spawn({
                task: req.task,
                label: req.label,
                role: req.role,
                parentSessionId: rawSessionId ?? "no-session",
                parentTurnId: currentTurnId ?? void 0,
                parentDepth: 0
              });
              sse.send({
                type: "subagent_spawned",
                runId: rr.runId,
                childSessionId: rr.childSessionId,
                label: req.label,
                role: req.role,
                task: req.task
              });
              return rr;
            }
          },
          signal: abort.signal,
          llmTimeout: clientTimeout,
          toolDescSubstitutions: {
            roles: (() => {
              const names = s.subagents.getProfileNames();
              if (!names.length) return "(no role profiles found in .minicodeide/agents/)";
              return names.map((p) => `${p.name}${p.description ? ` (${p.description})` : ""}`).join("; ");
            })()
          }
        })) {
          if (ev.type === "text" && ev.text) {
            assistantBuf += ev.text;
            if (persistSession && currentTurnId)
              s.sessions.appendChunk(rawSessionId, currentTurnId, ev.text).catch(() => void 0);
          }
          if (ev.type === "tool_call" && persistSession && currentTurnId) {
            s.sessions.appendTool(rawSessionId, currentTurnId, {
              name: ev.name,
              args: ev.args,
              result: ev.result,
              error: ev.error
            }).catch(() => void 0);
          }
          if (ev.type === "tool_call") {
            const name = ev.name;
            const args = ev.args;
            if (name && args) {
              if ((name === "edit_file" || name === "write_file") && args.path)
                s.recentActivity.record(chatSessionId, { kind: "edit", target: args.path });
              else if (name === "read_file" && args.path)
                s.recentActivity.record(chatSessionId, { kind: "read", target: args.path });
              else if (name === "grep_search" && args.regex)
                s.recentActivity.record(chatSessionId, { kind: "search", target: args.regex });
            }
          }
          if (ev.type === "done" && ev.reason) agentDoneReason = ev.reason;
          sse.send(ev);
        }
      }
    } catch (e) {
      agentDoneReason = "error";
      sse.send({ type: "error", error: e?.message ?? String(e) });
      if (persistSession && currentTurnId)
        await s.sessions.interruptTurn(rawSessionId, currentTurnId, e?.message ?? String(e)).catch(() => void 0);
    } finally {
      if (rawSessionId) {
        try {
          await s.subagents.awaitAllForParent(rawSessionId, 6e4);
        } catch {
        }
        const pending = s.subagents.pickPendingAnnouncements(rawSessionId);
        for (const ann of pending) sse.send({ type: "subagent_announce", message: ann });
      }
      if (persistSession && currentTurnId) {
        if (userAbort)
          await s.sessions.interruptTurn(rawSessionId, currentTurnId, "user_stop").catch(() => void 0);
        else
          await s.sessions.endTurn(rawSessionId, currentTurnId, assistantBuf).catch(() => void 0);
      }
      if (!userAbort && assistantBuf.length > 0 && (s.llmFast ?? s.llmChat)) {
        considerAutoMemory({
          llm: s.llmFast ?? s.llmChat,
          memory: s.memory,
          userMessage: rawUserMessage ?? "",
          assistantReply: assistantBuf,
          sessionId: chatSessionId,
          model: s.providers.getActive("fast")?.model ?? s.providers.getActive("chat")?.model,
          workspace: s.workspace,
          onSaved: (it) => {
            try {
              sse.send({ type: "memory_saved", title: it.title, category: it.category, scope: it.scope });
            } catch {
            }
          }
        }).catch(() => void 0);
      }
      sse.send({ type: "done", reason: userAbort ? "aborted" : agentDoneReason });
      sse.end();
    }
  });
}

// ../server/src/lsp-bridge.ts
import { spawn as spawn2 } from "node:child_process";

// ../../node_modules/.pnpm/ws@8.21.0/node_modules/ws/wrapper.mjs
var import_stream = __toESM(require_stream(), 1);
var import_extension = __toESM(require_extension(), 1);
var import_permessage_deflate = __toESM(require_permessage_deflate(), 1);
var import_receiver = __toESM(require_receiver(), 1);
var import_sender = __toESM(require_sender(), 1);
var import_subprotocol = __toESM(require_subprotocol(), 1);
var import_websocket = __toESM(require_websocket(), 1);
var import_websocket_server = __toESM(require_websocket_server(), 1);

// ../server/src/lsp-bridge.ts
function attachLspBridge(httpServer, opts) {
  const path27 = opts.path ?? "/lsp";
  const wss = new import_websocket_server.default({ noServer: true });
  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (!url.startsWith(path27)) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      const lang = url.slice(path27.length).replace(/^\//, "") || "ts";
      handleConnection(ws, lang, opts.cwd);
    });
  });
  console.log(`[lsp] bridge ready on ws://host${path27}/<lang>`);
}
function handleConnection(ws, lang, cwd) {
  let child = null;
  try {
    child = spawnLsp(lang, cwd);
  } catch (e) {
    console.error("[lsp] spawn failed", e);
    ws.close(1011, `LSP for ${lang} not available`);
    return;
  }
  child.on("error", (err) => {
    console.warn(`[lsp] ${lang} child error: ${err.message}. Hint: npm i -g typescript typescript-language-server`);
    try {
      ws.close(1011, "LSP backend not installed");
    } catch {
    }
  });
  console.log(`[lsp] ws connected for ${lang} (pid=${child.pid})`);
  ws.on("message", (data) => {
    if (!child || !child.stdin.writable) return;
    const text = typeof data === "string" ? data : data.toString("utf-8");
    const payload = `Content-Length: ${Buffer.byteLength(text, "utf8")}\r
\r
${text}`;
    try {
      child.stdin.write(payload);
    } catch {
    }
  });
  let buf = Buffer.alloc(0);
  child.stdout.on("data", (chunk) => {
    buf = Buffer.concat([buf, chunk]);
    while (true) {
      const headerEnd = buf.indexOf("\r\n\r\n");
      if (headerEnd === -1) return;
      const header = buf.slice(0, headerEnd).toString("utf8");
      const m = /Content-Length: (\d+)/i.exec(header);
      if (!m) {
        buf = buf.slice(headerEnd + 4);
        continue;
      }
      const len = Number(m[1]);
      const total = headerEnd + 4 + len;
      if (buf.length < total) return;
      const body = buf.slice(headerEnd + 4, total).toString("utf8");
      buf = buf.slice(total);
      try {
        ws.send(body);
      } catch {
      }
    }
  });
  child.stderr.on("data", (c) => {
    process.stderr.write(`[lsp/${lang}] ${c}`);
  });
  child.on("exit", (code) => {
    console.log(`[lsp] ${lang} child exited code=${code}`);
    try {
      ws.close();
    } catch {
    }
  });
  ws.on("close", () => {
    console.log(`[lsp] ws closed for ${lang}`);
    child?.kill();
  });
  ws.on("error", () => child?.kill());
}
function spawnLsp(lang, cwd) {
  switch (lang) {
    case "ts":
    case "tsx":
    case "js":
    case "jsx":
    case "typescript":
    case "javascript":
      return spawn2("typescript-language-server", ["--stdio"], { cwd });
    default:
      throw new Error(`Unsupported lang for LSP: ${lang}`);
  }
}

// ../server/src/terminal-bridge.ts
import { spawn as spawn3 } from "node:child_process";
function attachTerminalBridge(httpServer, opts) {
  const pathPrefix = opts.path ?? "/terminal";
  const wss = new import_websocket_server.default({ noServer: true });
  httpServer.on("upgrade", (req, socket, head) => {
    const url = req.url ?? "";
    if (!url.startsWith(pathPrefix)) return;
    wss.handleUpgrade(req, socket, head, (ws) => {
      handleConnection2(ws, opts);
    });
  });
  console.log(`[terminal] bridge ready on ws://host${pathPrefix}`);
}
function pickShell(override) {
  if (override) return { cmd: override, args: [] };
  const envShell = process.env.SHELL;
  if (envShell) return { cmd: envShell, args: ["-i"] };
  if (process.platform === "win32") {
    return { cmd: "powershell.exe", args: ["-NoLogo"] };
  }
  return { cmd: "/bin/sh", args: ["-i"] };
}
function handleConnection2(ws, opts) {
  let child = null;
  try {
    const { cmd, args } = pickShell(opts.shell);
    child = spawn3(cmd, args, {
      cwd: opts.cwd,
      env: { ...process.env, TERM: "xterm-256color", COLORTERM: "truecolor" }
    });
    console.log(`[terminal] spawned ${cmd} (pid=${child.pid}) cwd=${opts.cwd}`);
  } catch (e) {
    safeSend(ws, { type: "data", data: `\r
[terminal] failed to spawn shell: ${e?.message ?? e}\r
` });
    ws.close(1011, "spawn failed");
    return;
  }
  child.on("error", (err) => {
    safeSend(ws, { type: "data", data: `\r
[terminal] shell error: ${err.message}\r
` });
  });
  ws.on("message", (raw) => {
    if (!child) return;
    let msg;
    try {
      msg = JSON.parse(typeof raw === "string" ? raw : raw.toString("utf-8"));
    } catch {
      return;
    }
    switch (msg.type) {
      case "input": {
        if (child.stdin.writable && typeof msg.data === "string") {
          try {
            child.stdin.write(msg.data);
          } catch {
          }
        }
        break;
      }
      case "signal": {
        try {
          child.kill(msg.sig === "SIGTERM" ? "SIGTERM" : "SIGINT");
        } catch {
        }
        break;
      }
      case "resize": {
        break;
      }
    }
  });
  const forward = (data) => {
    safeSend(ws, { type: "data", data: data.toString("utf-8") });
  };
  child.stdout.on("data", forward);
  child.stderr.on("data", forward);
  child.on("exit", (code) => {
    safeSend(ws, { type: "exit", code: code ?? 0 });
    try {
      ws.close();
    } catch {
    }
  });
  ws.on("close", () => {
    try {
      child?.kill();
    } catch {
    }
  });
  ws.on("error", () => {
    try {
      child?.kill();
    } catch {
    }
  });
}
function safeSend(ws, obj) {
  if (ws.readyState !== ws.OPEN) return;
  try {
    ws.send(JSON.stringify(obj));
  } catch {
  }
}

// src/main.ts
var buckets = /* @__PURE__ */ new Map();
function takeToken(ip, capacity, windowMs = 6e4) {
  if (capacity <= 0) return true;
  const now = Date.now();
  let b = buckets.get(ip);
  if (!b) {
    b = { tokens: capacity, lastRefill: now };
    buckets.set(ip, b);
  }
  const elapsed = now - b.lastRefill;
  if (elapsed > windowMs) {
    b.tokens = capacity;
    b.lastRefill = now;
  } else {
    const refill = elapsed / windowMs * capacity;
    b.tokens = Math.min(capacity, b.tokens + refill);
    b.lastRefill = now;
  }
  if (b.tokens >= 1) {
    b.tokens -= 1;
    return true;
  }
  return false;
}
var authTokens = /* @__PURE__ */ new Set();
if (env.AUTH_TOKEN) authTokens.add(env.AUTH_TOKEN);
for (const t of env.AUTH_TOKENS) authTokens.add(t);
var authBypass = /* @__PURE__ */ new Set(["/health", "/api/health", "/api/version"]);
function checkAuth(req, pathname) {
  if (authTokens.size === 0) return true;
  if (authBypass.has(pathname)) return true;
  const auth = req.headers["authorization"] ?? "";
  const fromBearer = auth.startsWith("Bearer ") ? auth.slice(7) : "";
  const fromHeader = req.headers["x-mini-token"] ?? "";
  const provided = fromBearer || fromHeader;
  return !!provided && authTokens.has(provided);
}
async function main() {
  console.log(`[server-node] workspace = ${env.WORKSPACE}`);
  console.log("[server-node] initializing services...");
  const t0 = performance.now();
  const services = new Services(env.WORKSPACE);
  await services.init();
  console.log(`[server-node] services ready (${(performance.now() - t0).toFixed(1)}ms)`);
  const router = new Router();
  registerHandlers(router, services);
  console.log(`[server-node] ${router.snapshot().length} routes registered`);
  const handler = async (req, res) => {
    const start = Date.now();
    const reqIp = req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket.remoteAddress || "unknown";
    let url;
    try {
      url = new URL2(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
    } catch {
      res.writeHead(400, CORS_HEADERS).end("Bad Request");
      return;
    }
    const pathname = url.pathname;
    const method = (req.method ?? "GET").toUpperCase();
    if (method === "OPTIONS") {
      res.writeHead(204, CORS_HEADERS).end();
      return;
    }
    if (!checkAuth(req, pathname)) {
      return sendJson(res, 401, { error: "unauthorized", hint: "Missing/invalid token" });
    }
    if (!takeToken(reqIp, env.RATE_LIMIT)) {
      return sendJson(res, 429, { error: "rate limit exceeded" });
    }
    if (pathname === "/api/chat" && !takeToken(`chat:${reqIp}`, env.RATE_LIMIT_CHAT)) {
      return sendJson(res, 429, { error: "chat rate limit exceeded" });
    }
    const match = router.match(method, pathname);
    if (!match) {
      return sendJson(res, 404, { error: "not found", method, path: pathname });
    }
    try {
      await match.route.handler({
        req,
        res,
        url,
        params: match.params,
        query: queryToObject(url)
      });
    } catch (e) {
      console.error(`[server-node] handler error on ${method} ${pathname}`, e);
      if (!res.headersSent) sendJson(res, 500, { error: e?.message ?? String(e) });
      else {
        try {
          res.end();
        } catch {
        }
      }
    } finally {
      const dur = Date.now() - start;
      if (pathname !== "/api/chat" && pathname !== "/api/inline-edit") {
        console.log(`[http] ${method} ${pathname} ${res.statusCode} ${dur}ms`);
      }
    }
  };
  const httpServer = http.createServer(handler);
  attachLspBridge(httpServer, { path: "/lsp", cwd: env.WORKSPACE });
  attachTerminalBridge(httpServer, { path: "/terminal", cwd: env.WORKSPACE });
  httpServer.on("error", (err) => {
    if (err.code === "EADDRINUSE") {
      console.error(`[server-node] Port ${env.PORT} already in use, killing...`);
      try {
        execSync(`lsof -ti :${env.PORT} | xargs kill -9`, { stdio: "ignore" });
      } catch {
      }
      setTimeout(() => {
        httpServer.listen(env.PORT, () => {
          console.log(`[server-node] \u{1F680} listening on http://127.0.0.1:${env.PORT} (retry)`);
        });
      }, 1e3);
    } else {
      throw err;
    }
  });
  httpServer.listen(env.PORT, () => {
    console.log(`[server-node] \u{1F680} listening on http://127.0.0.1:${env.PORT}`);
    console.log(`[server-node] startup total ${(performance.now() - t0).toFixed(1)}ms`);
  });
  const shutdown = (sig) => {
    console.log(`[server-node] ${sig} received, closing...`);
    httpServer.close(() => process.exit(0));
    setTimeout(() => process.exit(1), 5e3).unref?.();
  };
  process.on("SIGTERM", () => shutdown("SIGTERM"));
  process.on("SIGINT", () => shutdown("SIGINT"));
}
main().catch((e) => {
  console.error("[server-node] fatal", e);
  process.exit(1);
});
/*! Bundled license information:

chokidar/index.js:
  (*! chokidar - MIT License (c) 2012 Paul Miller (paulmillr.com) *)
*/
//# sourceMappingURL=main.mjs.map
