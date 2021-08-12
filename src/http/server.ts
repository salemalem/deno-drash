import * as Drash from "../../mod.ts";
import { DrashRequest} from "./request.ts"

// TODO(crookse TODO-SERVICES) Remove this. We don't need this. Just set the
// services accordingly. I don't know what that means right now, but maybe I'll
// know what that means later.
interface IServices {
  external: {
    after_request: Drash.Interfaces.IService[];
    before_request: Drash.Interfaces.IService[];
  };
}

/**
 * This class handles the entire request-resource-response lifecycle. It is in
 * charge of handling incoming requests, matching them to resources for further
 * processing, and sending responses based on the processes set in the resource.
 * It is also in charge of sending error responses that "bubble up" during the
 * request-resource-response lifecycle.
 */
export class Server {
  /**
   * See Drash.Interfaces.IServerOptions.
   */
  public options: Drash.Interfaces.IServerOptions = {};

  /**
   * The Deno server object (after calling `serve()`).
   */
  #deno_server!: Deno.Listener;

  /**
   * The Deno server request object handler. This handler gets wrapped around
   * the Deno server request object and acts as a proxy to interact with the
   * Deno server request object.
   *
   * The Drash.Request object is not actually a request object. Surprise!
   */
  #handlers: {
    resource_handler: Drash.ResourceHandler;
  } = {
    resource_handler: Drash.Factory.create(Drash.ResourceHandler),
  };

  /**
   * The internal and external services used by this server. Internal services
   * are ones created by Drash. External services are ones specified by the
   * user.
   */
  #services: IServices = {
    external: {
      after_request: [],
      before_request: [],
    },
  };

  constructor(options: Drash.Interfaces.IServerOptions) {
    this.#setOptions(options);
    this.addExternalServices();
    this.#handlers.resource_handler.addResources(
      this.options.resources ?? [],
      this,
    );
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - FACTORY METHODS /////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Get the full address that this server is running on.
   */
  get address(): string {
    return `${this.options.protocol}://${this.options.hostname}:${this.options.port}`;
  }


  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - PUBLIC METHODS //////////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Close the server.
   */
  public close(): void {
    try {
      this.#deno_server.close();
    } catch (_error) {
      // Do nothing. The server was probably already closed.
    }
  }

  /**
   * Handle errors thrown during runtime. These errors get sent as the response
   * to the client.
   *
   * @param request - The request object.
   * @param error - The error that was thrown during runtime.
   */
  public handleError(
    error: Drash.Errors.HttpError,
    respondWith: (r: Response | Promise<Response>) => Promise<void>
  ) {
    // TODO(crookse TODO-ERRORS) The error should be a response object so we can
    // just call request.respond(error);
    respondWith(new Response(error.stack, {
      status: error.code,
    }));
  }

  /**
   * Handle an HTTP request from the Deno server.
   *
   * TODO (crookse TODO-SERVICES) Add in the middleware. Middleware is now
   * called services.  So, technically, add in the services.
   *
   * @param originalRequest - The Deno request object.
   */
  public async handleRequest(
    originalRequest: Request,
    respondWith: (r: Response | Promise<Response>) => Promise<void>
  ): Promise<void> {
    const request = new DrashRequest(originalRequest, this.options.memory)

    const resource = this.#handlers.resource_handler.getResource(request);

    if (!resource) {
      throw new Drash.Errors.HttpError(404);
    }

    const method = request.method.toUpperCase();

    // If the method does not exist on the resource, then the method is not
    // allowed. So, throw that 405 and GTFO.
    if (!(method in resource)) {
      throw new Drash.Errors.HttpError(405);
    }

    // Automatically parse the request body for the user.
    //
    // Although this call slows down the request-resource-response lifecycle
    // (removes ~1k req/sec in benchmarks), calling this here makes it more
    // convenient for the user when writing a resource. For example, if this
    // call were to be placed in the Drash.Request class and only executed when
    // a user wants to retrieve body params, then they would have to use
    // `async-await` in their resource.This means more boilerplate for their
    // resource, which is something we should prevent.
    if (request.body) {
      await request.parseBody();
    }

    // We set the resource on the request as late as possible to keep the
    // process of this method lean
    request.setResource(resource as Drash.Resource);

    // Execute the HTTP method on the resource
    const response = await resource![method as Drash.Types.THttpMethod]!();

    respondWith( new Response(response.parseBody(), {
      status: response.status,
      headers: response.headers,
    }));
  }

  /**
   * Listen for incoming requests.
   */
  public async listenForRequests() {
    console.log('liteni')
    // TODO :: Wrap in async annonymosu function to handle multiple reqs
    for await (const conn of this.#deno_server) {
        console.log('GOT CONN')

        for await (const { request, respondWith } of Deno.serveHttp(conn)) {
        try {
          console.log('got rew')
          await this.handleRequest(request, respondWith);
        } catch (error) {
          await this.handleError(error, respondWith);
        }
      }
    }
  }

  /**
   * Run the server in HTTP mode.
   *
   * @returns The Deno server object.
   */
  public async runHttp(): Promise<Deno.Listener> {
    this.options.protocol = "http";
    console.log(this.options)
    this.#deno_server = Deno.listen({
      hostname: this.options.hostname!,
      port: this.options.port!,
    });

    await this.listenForRequests();

    return this.#deno_server;
  }

  /**
   * Run the server in HTTPS mode.
   *
   * @returns The Deno server object.
   */
  public async runHttps(): Promise<Deno.Listener> {
    this.options.protocol = "https";

    this.#deno_server = Deno.listenTls({
      hostname: this.options.hostname!,
      port: this.options.port!,
      certFile: this.options.cert_file!,
      keyFile: this.options.key_file!,
    });

    await this.listenForRequests();

    return this.#deno_server;
  }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - PROTECTED METHODS ///////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  /**
   * Add the external services passed in via options.
   */
  protected async addExternalServices(): Promise<void> {
    // No services? GTFO.
    if (!this.options.services) {
      return;
    }

    // Add server-level services that execute before all requests
    if (this.options.services.before_request) {
      await this.addExternalServicesBeforeRequest(
        this.options.services.before_request,
      );
    }

    // Add server-level services that execute after all requests
    if (this.options.services.after_request) {
      await this.addExternalServicesAfterRequest(
        this.options.services.after_request,
      );
    }
  }

  /**
   * Add the external services that should execute after a request.
   *
   * @param services - An array of Service types.
   */
  protected async addExternalServicesAfterRequest(
    services: typeof Drash.Service[],
  ): Promise<void> {
    for (const s of services) {
      // TODO(crookse TODO-SERVICES) Make this new call use the Factory.
      // @ts-ignore
      const service = new (s as Drash.Interfaces.IService)();
      // Check if this service needs to be set up
      if (service.setUp) {
        await service.setUp();
      }
      this.#services.external.after_request!.push(service);
    }
  }

  /**
   * Add the external services that should execute before a request.
   *
   * @param services - An array of Service types.
   */
  protected async addExternalServicesBeforeRequest(
    services: typeof Drash.Service[],
  ): Promise<void> {
    for (const s of services) {
      // TODO(crookse TODO-SERVICES) Make this new call use the Factory.
      // @ts-ignore
      const service = new (s as Drash.Interfaces.IService)();
      // Check if this service needs to be set up
      if (service.setUp) {
        await service.setUp();
      }
      this.#services.external.before_request!.push(service);
    }
  }

  /**
   * Execute server-level services after the request.
   *
   * @param request - The request object.
   * @param resource - The resource object.
   */
  // protected async executeApplicationServicesAfterRequest(
  //   request: any,
  //   response: Response,
  // ): Promise<void> {
  //   if (!this.services.external.after_request) {
  //     return;
  //   }

  //   for (const index in this.services.external.after_request) {
  //     const service = this.services.external.after_request[index];
  //     if (service.runAfterRequest) {
  //       service.runAfterRequest(request, response);
  //     }
  //   }
  // }

  /**
   * Execute server-level services before the request.
   *
   * @param request - The request object.
   * @param resource - The resource object.
   */
  // protected async executeApplicationServicesBeforeRequest(
  //   request: Request,
  // ): Promise<void> {
  //   if (!this.services.external.before_request) {
  //     return;
  //   }

  //   for (const index in this.services.external.before_request) {
  //     const service = this.services.external.before_request[index];
  //     if (service.runBeforeRequest) {
  //       service.runBeforeRequest(request);
  //     }
  //   }
  // }

  //////////////////////////////////////////////////////////////////////////////
  // FILE MARKER - METHODS - PRIVATE ///////////////////////////////////////////
  //////////////////////////////////////////////////////////////////////////////

  #setOptions(options: Drash.Interfaces.IServerOptions): any {
    if (!options.default_response_content_type) {
      options.default_response_content_type = "application/json";
    }

    if (!options.hostname) {
      options.hostname = "0.0.0.0";
    }

    if (!options.memory) {
      options.memory = {};
    }

    if (!options.memory.multipart_form_data) {
      options.memory.multipart_form_data = 10;
    }

    if (!options.port) {
      options.port = 1337;
    }

    if (!options.resources) {
      options.resources = [];
    }

    if (!options.services) {
      options.services = {
        after_request: [],
        before_request: [],
      };
    }

    this.options = options;
  }
}
