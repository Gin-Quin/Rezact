import { render } from "rezact";
import { Signal } from "./signals";

class RouteNode {
  handlers: any;
  children: Map<any, any>;
  dynamicChild: any = null;
  wildcardHandler: any = null;
  constructor() {
    this.handlers = {};
    this.children = new Map();
    this.dynamicChild = null;
    this.wildcardHandler = null;
  }
}

export class TrieRouter {
  root: RouteNode;
  renderFunc: any = null;
  noRoute: any = (router) => {
    router.routeRequest("/404");
  };
  constructor(options) {
    if (options.render) this.renderFunc = options.render;
    if (options.noRoute) this.noRoute = options.noRoute;
    document.body.addEventListener("click", (ev: any) => {
      if (ev.target.nodeName === "A") {
        if (!ev.target.href) return;
        if (ev.target.target) return;
        const url = new URL(ev.target.href);
        const locationHost = window.location.hostname; // Current page's hostname
        if (url.hostname !== locationHost) return;
        ev.preventDefault();
        history.pushState({}, "", url.pathname);
        this.routeRequest(url.pathname);
      }
    });
    this.root = new RouteNode();
    window.onpopstate = this.routeChanged.bind(this);
  }

  routeChanged() {
    const url = window.location.pathname;
    this.routeRequest(url);
  }

  addRoute(path, callback) {
    const parts = path.split("/").filter(Boolean);
    let currentNode = this.root;

    for (let part of parts) {
      if (part.startsWith(":")) {
        if (!currentNode.dynamicChild) {
          currentNode.dynamicChild = new RouteNode();
          currentNode.dynamicChild.isDynamic = part.slice(1);
        }
        currentNode = currentNode.dynamicChild;
      } else if (part === "*") {
        currentNode.wildcardHandler = callback;
        return; // wildcard matches the rest of the route, so return
      } else {
        if (!currentNode.children.has(part)) {
          currentNode.children.set(part, new RouteNode());
        }
        currentNode = currentNode.children.get(part);
      }
    }

    currentNode.handlers.GET = callback;
  }

  routeRequest(path) {
    const parts = path.split("/").filter(Boolean);
    let currentNode = this.root;
    let params = {};

    for (let part of parts) {
      if (currentNode.children.has(part)) {
        currentNode = currentNode.children.get(part);
      } else if (currentNode.dynamicChild) {
        params[currentNode.dynamicChild.isDynamic] = part;
        currentNode = currentNode.dynamicChild;
      } else if (currentNode.wildcardHandler) {
        currentNode.wildcardHandler(params);
        return; // wildcard matches the rest of the route, so return
      } else {
        console.log(`No route found for path: ${path}`);
        this.noRoute(this);
        return;
      }
    }

    if (currentNode.handlers.GET) {
      if (this.renderFunc) {
        this.renderFunc(currentNode.handlers.GET(), params);
      } else {
        currentNode.handlers.GET(params);
      }
    } else {
      console.log(`No handle found for path: ${path}`);
      this.noRoute(this);
      return;
    }
  }
}

export function useRouter(app = null, config = null) {
  if (config) return new TrieRouter(config);

  if (!app) app = document.getElementById("app");

  let currentLayout = null;
  let router_outlet = new Signal(document.createElement("span"));
  return new TrieRouter({
    render: async (page, params) => {
      const mod = await page;
      const component = mod.Page || mod.default;
      if (mod.Layout) {
        if (currentLayout === mod.Layout) {
          render(router_outlet, component, { routeParams: params });
        } else {
          currentLayout = mod.Layout;

          render(router_outlet, component, { routeParams: params });

          render(app, (props) => mod.Layout(props), {
            router_outlet,
            routeParams: params,
          });
        }
      } else {
        currentLayout = null;
        render(app, mod.Page || mod.default, { routeParams: params });
      }
    },
  });
}
