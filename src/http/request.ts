import * as Drash from "../../mod.ts";

export class Request {
  #parsed_body?: Drash.Types.TRequestBody;
  #options!: Drash.Interfaces.IRequestOptions;
  #server!: Drash.Server;
  #original!: Drash.Deps.ServerRequest;
  #path_params!: string;
  #resource!: Drash.Resource;

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - FACTORY ///////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  public async create(
    options: Drash.Interfaces.IRequestOptions,
  ): Promise<void> {
    this.#setOptions(options);
    this.#setProperties();
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - GETTERS AND SETTERS /////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  get body(): Deno.Reader {
    return this.#original.body;
  }

  get has_body(): boolean {
    let contentLength = this.#original.headers.get("content-length");

    if (!contentLength) {
      contentLength = this.#original.headers.get("Content-Length");
    }

    if (!contentLength) {
      return false;
    }

    return +contentLength > 0;
  }

  get method(): string {
    return this.#original.method;
  }

  get params(): any {
    console.log("get params");

    return {
      query: new URLSearchParams(this.url.parameters),
      path: new URLSearchParams(this.#resource.path_params),
      body: this.#parsed_body,
    };
  }

  get url(): Drash.Interfaces.IRequestUrl {
    const anchorSplit = this.#original.url.includes("#")
      ? this.#original.url.split("#")
      : null;
    const anchor = anchorSplit
      ? anchorSplit[anchorSplit.length - 1]
      : undefined;

    const parametersSplit = this.#original.url.includes("?")
      ? this.#original.url.split("?")[1]
      : null;
    const parameters = parametersSplit
      ? parametersSplit.split("#").join("")
      : undefined;

    const path = this.#original.url.split("?")[0];

    const scheme = this.#server.options.protocol!;

    let authority = this.#original.headers.get("host") ?? "";

    let domain = authority.split(":")[0];

    let port = +authority.split(":")[1];
    if (!port) {
      port = scheme == "https" ? 443 : 80;
    }

    return {
      anchor,
      authority,
      domain,
      parameters,
      path,
      port,
      scheme,
    };
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - PUBLIC ////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Used to check which headers are accepted.
   *
   * @param type - It is either a string or an array of strings that contains
   * the Accept Headers.
   * @returns Either true or the string of the correct header.
   */
  public accepts(contentTypes: string[]): boolean {
    let acceptHeader = this.#original.headers.get("Accept");

    if (!acceptHeader) {
      acceptHeader = this.#original.headers.get("accept");
    }

    if (!acceptHeader) {
      return false;
    }

    const matches = contentTypes.filter((contentType) => {
      return acceptHeader!.includes(contentType);
    });

    return matches.length > 0;
  }

  /**
   * Set the `request.path_params` property after finding the given resource so
   * the user can access them via `this.#original.getPathParamValue()`.
   *
   * How it works: If we have the following request URI ...
   *
   *     /hello/world/i-love-you
   *
   * and it was matched to a resource with the following URI ...
   *
   *    /hello/:thing/:greeting
   *
   * then we end up with two arrays ...
   *
   *     resource's defined path params: [ "thing", "greeting" ]
   *     request's given path params:    [ "world", "i-love-you" ]
   *
   * that get merged merged into key-value pairs ...
   *
   *     { thing: "world", greeting: "i-love-you" }
   *
   * The first array serves as the keys and the second array serves the value of
   * the keys.
   *
   * @param resource - The resource object.
   */
  public setPathParams(params: string): void {
    this.#path_params = params;
  }

  /**
   * Get a cookie value by the name that is sent in with the request.
   *
   * @param cookie - The name of the cookie to retrieve
   *
   * @returns The cookie value associated with the cookie name or `undefined` if
   * a cookie with that name doesn't exist
   */
  public getCookie(name: string): string {
    const cookies: { [key: string]: string } = Drash.Deps.getCookies(
      this.#original,
    );
    return cookies[name];
  }

  /**
   * Parse the specified request's body.
   *
   * @param options - See IOptions.
   *
   * @returns The content type of the body, and based on this the body itself in
   * that format. If there is no body, it returns an empty properties
   */
  public async parseBody(): Promise<void> {
    if (!this.has_body) {
      return;
    }

    let contentType = this.#original.headers.get(
      "Content-Type",
    );

    if (!contentType) {
      contentType = this.#original.headers.get(
        "content-type",
      );
    }

    // No Content-Type header? Default to parsing the request body as
    // aplication/x-www-form-urlencoded.
    if (!contentType) {
      this.#parsed_body = await this.parseBodyAsFormUrlEncoded(true);
      return;
    }

    if (contentType.includes("multipart/form-data")) {
      this.#parsed_body = await this.parseBodyAsMultipartFormData(
        contentType,
      );
      return;
    }

    if (contentType.includes("application/json")) {
      this.#parsed_body = await this.parseBodyAsJson();
      return;
    }

    if (contentType.includes("application/x-www-form-urlencoded")) {
      this.#parsed_body = await this.parseBodyAsFormUrlEncoded();
      return;
    }
  }

  /**
   * Parse this.#original's body as application/x-www-form-url-encoded.
   *
   * @returns A `Promise` of an empty object if no body exists, else a key/value
   * pair array (e.g., `returnValue['someKey']`).
   */
  public async parseBodyAsFormUrlEncoded(
    parseByDefault: boolean = false,
  ): Promise<Drash.Interfaces.IKeyValuePairs<unknown>> {
    try {
      let body = Drash.Deps.decoder.decode(
        await Deno.readAll(this.#original.body),
      );

      if (body.indexOf("?") !== -1) {
        body = body.split("?")[1];
      }

      body = body.replace(/\"/g, "");

      return {};
    } catch (error) {
      if (parseByDefault) {
        throw new Drash.Errors.HttpError(
          400,
          `Error reading request body. No Content-Type header was specified. ` +
            `Therefore, the body was parsed as application/x-www-form-urlencoded ` +
            `by default and failed.`,
        );
      }
      throw new Drash.Errors.HttpError(
        400,
        `Error reading request body as application/x-www-form-urlencoded. ${error.message}`,
      );
    }
  }

  /**
   * Parse this.#original's body as application/json.
   *
   * @returns A `Promise` of a JSON object decoded from request body.
   */
  public async parseBodyAsJson(): Promise<{ [key: string]: unknown }> {
    try {
      let data = Drash.Deps.decoder.decode(
        await Deno.readAll(this.#original.body),
      );

      // Check if the JSON string contains ' instead of ". We need to convert
      // those so we can call JSON.parse().
      if (data.match(/'/g)) {
        data = data.replace(/'/g, `"`);
      }

      return JSON.parse(data);
    } catch (error) {
      throw new Drash.Errors.HttpError(
        400,
        `Error reading request body as application/json. ${error.message}`,
      );
    }
  }

  /**
   * Parse this.#original's body as multipart/form-data.
   *
   * @param body - The request's body.
   * @param boundary - The boundary of the part (e.g., `----------437192313`)
   * @param maxMemory - The maximum memory to allocate to this process in
   * megabytes.
   *
   * @return A Promise<MultipartFormData>.
   */
  public async parseBodyAsMultipartFormData(
    contentType: string,
  ): Promise<Drash.Deps.MultipartFormData> {
    let boundary: null | string = null;

    // Special thanks to https://github.com/artisonian for helping parse the
    // boundary logic below
    try {
      const match = contentType.match(/boundary=([^\s]+)/);
      if (match) {
        boundary = match[1];
      }
      if (!boundary) {
        throw new Drash.Errors.DrashError("D1004");
      }
    } catch (error) {
      throw new Drash.Errors.DrashError("D1004");
    }

    // Convert memory to megabytes for parsing multipart/form-data
    const maxMemory = 1024 * 1024 * this.#options.memory!.multipart_form_data!;

    try {
      const mr = new Drash.Deps.MultipartReader(this.#original.body, boundary);
      return await mr.readForm(maxMemory);
    } catch (error) {
      throw new Drash.Errors.DrashError("D1005");
    }
  }

  public setResource(resource: Drash.Resource): void {
    this.#resource = resource;
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - PRIVATE ///////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  #setOptions(options: Drash.Interfaces.IRequestOptions): void {
    if (!options.original) {
      throw new Drash.Errors.DrashError("D1002");
    }

    if (!options.server) {
      throw new Drash.Errors.DrashError("D1003");
    }

    if (!options.memory) {
      options.memory = {
        multipart_form_data: 128,
      };
    }

    if (!options.memory.multipart_form_data) {
        options.memory.multipart_form_data = 128;
    }

    this.#options = options;
  }

  #setProperties(): void {
    this.#server = this.#options.server!;
    this.#original = this.#options.original!;
  }
}
