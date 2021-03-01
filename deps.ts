const decoder = new TextDecoder();
const encoder = new TextEncoder();
export { decoder, encoder };

////////////////////////////////////////////////////////////////////////////////
// FILE MARKER - MODULES ///////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

export {
  serve,
  Server,
  ServerRequest,
  serveTLS,
} from "https://deno.land/std@0.88.0/http/server.ts";

export {
  Status,
  STATUS_TEXT,
} from "https://deno.land/std@0.87.0/http/http_status.ts";

export { BufReader } from "https://deno.land/std@0.87.0/io/bufio.ts";

export { StringReader } from "https://deno.land/std@0.87.0/io/readers.ts";

export {
  MultipartReader,
} from "https://deno.land/std@0.87.0/mime/multipart.ts";

export {
  deleteCookie,
  getCookies,
  setCookie,
} from "https://deno.land/std@0.87.0/http/cookie.ts";

export {
  green,
  red
} from "https://deno.land/std@0.87.0/fmt/colors.ts";

export {
  IndexService,
  BumperService,
  ConsoleLogger,
} from "https://raw.githubusercontent.com/drashland/services/v0.1.0/mod.ts";


////////////////////////////////////////////////////////////////////////////////
// FILE MARKER - TYPES /////////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

export type {
  HTTPOptions,
  HTTPSOptions,
  Response,
} from "https://deno.land/std@0.87.0/http/server.ts";

export type {
  ISearchResult,
} from "https://raw.githubusercontent.com/drashland/services/v0.1.0/index/index_service.ts";

export type {
  ReadLineResult
} from "https://deno.land/std@0.87.0/io/bufio.ts";

export type {
  FormFile,
  MultipartFormData,
} from "https://deno.land/std@0.87.0/mime/multipart.ts";

export type {
  Cookie
} from "https://deno.land/std@0.87.0/http/cookie.ts";
