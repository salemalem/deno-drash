import {
  Drash,
  isFormFile,
  MultipartReader,
  path,
  Rhum,
  TestHelpers,
} from "../../../deps.ts";
const encoder = new TextEncoder();

Rhum.testPlan("http/request_test.ts", () => {
  Rhum.testSuite("accepts()", () => {
    acceptsTests();
  });

  Rhum.testSuite("has_body", () => {
    hasBodyTests();
  });

  Rhum.testSuite("parseBody()", () => {
    parseBodyTests();
  });
});

Rhum.run();

////////////////////////////////////////////////////////////////////////////////
// FILE MARKER - DATA PROVIDERS ////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

// Taken  from https://github.com/denoland/deno/blob/2da084058397efd6f517ba98c9882760ec0a7bd6/cli/tests/unit/fetch_test.ts#L261
// It's how Deno test their multipart tests
const files = [
  {
    // prettier-ignore
    content: new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 137, 1, 25]),
    type: "image/png",
    name: "image",
    fileName: "some-image.png",
  },
  {
    // prettier-ignore
    content: new Uint8Array(
      [
        108,
        2,
        0,
        0,
        145,
        22,
        162,
        61,
        157,
        227,
        166,
        77,
        138,
        75,
        180,
        56,
        119,
        188,
        177,
        183,
      ],
    ),
    name: "file",
    fileName: "file.bin",
    expectedType: "application/octet-stream",
  },
  {
    content: new TextEncoder().encode("deno land"),
    type: "text/plain",
    name: "text",
    fileName: "deno.txt",
  },
];

////////////////////////////////////////////////////////////////////////////////
// FILE MARKER - TEST CASES ////////////////////////////////////////////////////
////////////////////////////////////////////////////////////////////////////////

function acceptsTests() {
  Rhum.testCase(
    "accepts the single type if it is present in the header",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          Accept: "application/json;text/html",
        },
      });

      const request = TestHelpers.createRequest(serverRequest);
      let actual;

      actual = request.accepts("application/json");
      Rhum.asserts.assertEquals(actual, true);

      actual = request.accepts("text/html");
      Rhum.asserts.assertEquals(actual, true);
    },
  );

  Rhum.testCase(
    "rejects the single type if it is not present in the header",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          Accept: "application/json;text/html",
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      let actual;
      actual = request.accepts("text/xml");
      Rhum.asserts.assertEquals(actual, false);
    },
  );

  Rhum.testCase(
    "accepts the first of multiple types if it is present in the header",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          Accept: "application/json;text/html",
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      let actual;
      actual = request.accepts(["application/json", "text/xml"]);
      Rhum.asserts.assertEquals(actual, true);
    },
  );

  Rhum.testCase(
    "accepts the second of multiple types if it is present in the header",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          Accept: "application/json;text/html",
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      let actual;
      actual = request.accepts(["text/xml", "application/json"]);
      Rhum.asserts.assertEquals(actual, true);
    },
  );

  Rhum.testCase(
    "rejects the multiple types if none are present in the header",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          Accept: "application/json;text/html",
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      let actual;
      actual = request.accepts(["text/xml", "text/plain"]);
      Rhum.asserts.assertEquals(actual, false);
    },
  );
}

// TODO(crookse TODO-REQUEST-COOKIE) Test this.
// function getCookieTests() {
//   Rhum.testCase("Returns the cookie value if it exists", () => {
//     const serverRequest = TestHelpers.mockRequest("/", "get", {
//       headers: {
//         Accept: "application/json;text/html",
//         Cookie: "test_cookie=test_cookie_value",
//         credentials: "include",
//       },
//     });
//     const request = TestHelpers.createRequest(serverRequest);
//     const cookieValue = request.getCookie("test_cookie");
//     Rhum.asserts.assertEquals(cookieValue, "test_cookie_value");
//   });
//   Rhum.testCase("Returns undefined if the cookie does not exist", () => {
//     const serverRequest = TestHelpers.mockRequest("/", "get", {
//       headers: {
//         Accept: "application/json;text/html",
//         Cookie: "test_cookie=test_cookie_value",
//         credentials: "include",
//       },
//     });
//     const request = TestHelpers.createRequest(serverRequest);
//     const cookieValue = request.getCookie("cookie_doesnt_exist");
//     Rhum.asserts.assertEquals(cookieValue, undefined);
//   });
// }

function hasBodyTests() {
  Rhum.testCase(
    "Returns true when content-length is in the header as an int",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          "content-length": 52,
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      Rhum.asserts.assertEquals(request.has_body, true);
    },
  );

  Rhum.testCase(
    "Returns true when Content-Length is in the header as an int",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          "Content-Length": 52,
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      Rhum.asserts.assertEquals(request.has_body, true);
    },
  );

  Rhum.testCase(
    "Returns false when content-length is not in the header",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get");
      const request = TestHelpers.createRequest(serverRequest);
      Rhum.asserts.assertEquals(request.has_body, false);
    },
  );

  Rhum.testCase(
    "Returns false when content-length is in the header but not as an int",
    () => {
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          "content-length": "yes",
        },
      });
      const request = TestHelpers.createRequest(serverRequest);
      Rhum.asserts.assertEquals(request.has_body, false);
    },
  );
}

function parseBodyTests() {
  Rhum.testCase(
    "Returns the default object when request has no body",
    async () => {
      const serverRequest = TestHelpers.mockRequest("/");
      const request = TestHelpers.createRequest(serverRequest);
      const ret = await request.parseBody();
      Rhum.asserts.assertEquals(ret, {
        content_type: "",
        data: undefined,
      });
    },
  );

  Rhum.testCase(
    "Defaults to application/x-www-form-urlencoded when header contains no content type",
    async () => {
      const body = encoder.encode("hello=world");
      const reader = new Deno.Buffer(body as ArrayBuffer);
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        body: reader,
      });
      const request = TestHelpers.createRequest(serverRequest);
      const ret = await request.parseBody();
      Rhum.asserts.assertEquals(ret, {
        content_type: "application/x-www-form-urlencoded",
        data: {
          hello: "world",
        },
      });
    },
  );

  Rhum.testCase(
    "Returns the default object when no boundary was found on multipart/form-data",
    async () => {
      const serverRequest = TestHelpers.mockRequest("/orig", "post");
      const newRequest = TestHelpers.createRequest(serverRequest);
      newRequest.headers.set("Content-Type", "multipart/form-data"); // Needed since the method gets boundary from header
      newRequest.headers.set("Content-Length", "883"); // Tells parseBody that this request has a body
      const result = await newRequest.parseBody();
      Rhum.asserts.assertEquals(result, {
        content_type: "",
        data: undefined,
      });
    },
  );

  Rhum.testCase(
    "Fails when cannot parse the body as multipart/form-data",
    async () => {
      const serverRequest = TestHelpers.mockRequest("/orig", "post", {
        body: JSON.stringify({ name: "John" }),
      });
      const newRequest = TestHelpers.createRequest(serverRequest);
      newRequest.headers.set(
        "Content-Type",
        "multipart/form-data; boundary=--------------------------434049563556637648550474",
      ); // Needed since the method gets boundary from header
      newRequest.headers.set("Content-Length", "883"); // Tells parseBody that this request has a body
      let hasErrored = false;
      let errorMessage = "";
      try {
        await newRequest.parseBody();
      } catch (err) {
        hasErrored = true;
        errorMessage = err.message;
      }
      Rhum.asserts.assertEquals(hasErrored, true);
      Rhum.asserts.assertEquals(
        errorMessage,
        "Error reading request body as multipart/form-data.",
      );
    },
  );

  Rhum.testCase("Can correctly parse as application/json", async () => {
    const encodedBody = new TextEncoder().encode(JSON.stringify({
      name: "John",
    }));
    const body = new Deno.Buffer(encodedBody as ArrayBuffer);
    const serverRequest = TestHelpers.mockRequest("/", "post", {
      headers: {
        "Content-Type": "application/json",
      },
      body: body,
    });
    const request = TestHelpers.createRequest(serverRequest);
    const ret = await request.parseBody();
    Rhum.asserts.assertEquals(ret, {
      content_type: "application/json",
      data: { name: "John" },
    });
  });

  Rhum.testCase(
    "Fails when error thrown whilst parsing as application/json",
    async () => {
      let errorThrown = false;
      try {
        const serverRequest = TestHelpers.mockRequest("/", "post", {
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: "John",
          }),
        });
        const request = TestHelpers.createRequest(serverRequest);
        const ret = await request.parseBody();
        Rhum.asserts.assertEquals(ret, {
          content_type: "application/json",
          data: { name: "John" },
        });
      } catch (err) {
        errorThrown = true;
      }
      Rhum.asserts.assertEquals(errorThrown, true);
    },
  );

  Rhum.testCase(
    "Can correctly parse as application/x-www-form-urlencoded",
    async () => {
      const body = encoder.encode("hello=world");
      const reader = new Deno.Buffer(body as ArrayBuffer);
      const serverRequest = TestHelpers.mockRequest("/", "get", {
        headers: {
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: reader,
      });
      const request = TestHelpers.createRequest(serverRequest);
      const ret = await request.parseBody();
      Rhum.asserts.assertEquals(ret, {
        content_type: "application/x-www-form-urlencoded",
        data: {
          hello: "world",
        },
      });
    },
  );
}
