
const routes = {};

const fakeApp = {
  use: jest.fn(),

  get: jest.fn((path, callback) => {
    routes[path] = callback;
  }),

  post: jest.fn((path, callback) => {
    routes[path] = callback;
  }),

  listen: jest.fn((port, host, callback) => {
    if (typeof callback === "function") {
      callback();
    }
  })
};

// Simuler Express avant de charger server.js
jest.doMock("express", () => {
  const express = jest.fn(() => fakeApp);

  express.json = jest.fn(() => jest.fn());

  return express;
});

// Simuler CORS
jest.doMock("cors", () => jest.fn(() => jest.fn()));

// Éviter l'affichage du message de démarrage pendant les tests
jest.spyOn(console, "log").mockImplementation(() => {});

// Forcer le premier chargement à utiliser le port par défaut
const originalPort = process.env.PORT;
delete process.env.PORT;

require("./server.js");

if (originalPort !== undefined) {
  process.env.PORT = originalPort;
}

// Construire une réponse Express simulée
function createResponse() {
  const response = {
    statusCode: 200,
    body: null,

    status(code) {
      this.statusCode = code;
      return this;
    },

    json(data) {
      this.body = data;
      return this;
    }
  };

  return response;
}

// Exécuter une route avec une requête simulée
function executeRoute(path, body) {
  const req = { body };
  const res = createResponse();

  routes[path](req, res);

  return res;
}

// =========================
// TESTS DE /login
// =========================

describe("POST /login", () => {
  test("accepte les identifiants corrects", () => {
    const res = executeRoute("/login", {
      username: "admin",
      password: "docker"
    });

    expect(res.statusCode).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.message).toBe(
      "Bienvenue. Et surtout, ne touche pas au bouton."
    );
  });

  test("refuse un nom d'utilisateur incorrect", () => {
    const res = executeRoute("/login", {
      username: "inconnu",
      password: "docker"
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Identifiants incorrects.");
  });

  test("refuse un mot de passe incorrect", () => {
    const res = executeRoute("/login", {
      username: "admin",
      password: "incorrect"
    });

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test("gère un corps de requête absent", () => {
    const res = executeRoute("/login", undefined);

    expect(res.statusCode).toBe(401);
    expect(res.body.success).toBe(false);
    expect(res.body.message).toBe("Identifiants incorrects.");
  });
});

// =========================
// TESTS DE /click
// =========================

describe("POST /click", () => {
  test.each([
    ["corps absent", undefined],
    ["nombre absent", {}],
    ["nombre sous la limite", { count: 0 }],
    ["nombre au-dessus de la limite", { count: 31 }],
    ["nombre non entier", { count: 1.5 }],
    ["chaîne de caractères", { count: "1" }]
  ])("refuse une entrée invalide : %s", (_description, body) => {
    const res = executeRoute("/click", body);

    expect(res.statusCode).toBe(400);
    expect(res.body.error).toBe(
      "Le nombre de clics doit être compris entre 1 et 30."
    );
  });

  test("accepte le premier clic", () => {
    const res = executeRoute("/click", { count: 1 });

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(1);
    expect(res.body.message).toBe("Je t'avais pourtant prévenu.");
    expect(res.body.finished).toBe(false);
  });

  test("accepte le dernier clic et termine la séquence", () => {
    const res = executeRoute("/click", { count: 30 });

    expect(res.statusCode).toBe(200);
    expect(res.body.count).toBe(30);
    expect(res.body.message).toContain("BOUM !");
    expect(res.body.finished).toBe(true);
  });
});

// =========================
// TEST DU PORT CONFIGURÉ
// =========================

test("utilise le port défini dans les variables d'environnement", () => {
  process.env.PORT = "4567";

  jest.resetModules();
  require("./server.js");

  expect(fakeApp.listen).toHaveBeenLastCalledWith(
    "4567",
    "0.0.0.0",
    expect.any(Function)
  );

  if (originalPort === undefined) {
    delete process.env.PORT;
  } else {
    process.env.PORT = originalPort;
  }
});

// =========================
// TEST HEALTHCHECK
// =========================
describe("GET /health", () => {
  test("vérifie que la route health retourne 200 et le statut ok", () => {
    const req = {};

    const res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };

    routes["/health"](req, res);

    expect(res.status).toHaveBeenCalledWith(200);
    expect(res.json).toHaveBeenCalledWith({
      status: "ok"
    });
  });
});