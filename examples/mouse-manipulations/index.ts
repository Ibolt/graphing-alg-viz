import Graph from "graphology";
import Sigma from "sigma";
import { v4 as uuid } from "uuid";
import NodeProgramBorder from "./node.border";

let vertices = [];
let edges = [];

// Init graph
const container = document.getElementById("sigma-container") as HTMLElement;
const graph = new Graph();
const renderer = new Sigma(graph, container, {
  nodeProgramClasses: {
    border: NodeProgramBorder,
  },
});

// Settings
const defaultHoverRenderer = renderer.getSetting("hoverRenderer");
renderer.setSetting("minCameraRatio", 1);
renderer.setSetting("maxCameraRatio", 1);
renderer.getMouseCaptor().on("wheel", (e) => e.preventSigmaDefault());
renderer.on("doubleClickNode", (e) => e.preventSigmaDefault());
renderer.on("enterNode", (e) => e.preventSigmaDefault());

const updateEdge = (source, target) => {
  graph.updateEdge(source, target, (attrs) => {
    return {
      ...attrs,
      color: "green",
    };
  });
};

const updateVertex = (v) => {
  graph.updateNode(v, (attrs) => {
    return {
      ...attrs,
      color: "green",
    };
  });
};

// BFS
const bfs = async () => {
  let root = vertices[0];
  let queue = [];
  let visited = [];
  updateVertex(root.id);
  queue.push(root.id.toString());
  visited.push(root.id.toString());

  while (queue.length) {
    const u = queue.shift();
    const neighbours = graph.neighbors(u);
    console.log("node:", u, "neighbours:", neighbours);

    neighbours.forEach(async (v) => {
      if (!visited.includes(v)) {
        console.log("iterating on neighbour", v, "currently visited:", visited);
        visited.push(v);
        queue.push(v);

        updateEdge(u, v);
        updateVertex(v);
      }
    });
    console.log("finished, visited:", visited);
  }

  root = null;
  queue = [];
  visited = [];
};

document.getElementById("bfs-btn").onclick = bfs;
//
// Drag'n'drop feature
// ~~~~~~~~~~~~~~~~~~~
//

// State for drag'n'drop
let draggedNode: string | null = null;
let isDragging = false;
let isDoubleClicked = false;
let doubleClickedNode = null;
let doubleClickTargetNode = null;
let count = 0;

// On mouse down on a node
//  - we enable the drag mode
//  - save in the dragged node in the state
//  - highlight the node
//  - disable the camera so its state is not updated
const targetRange = 0.05;
const node_size = 20;
renderer.on("downNode", (e) => {
  console.log("* node click *");
  if (isDoubleClicked) {
    console.log("ended double click on node", e.node);
    renderer.setSetting("hoverRenderer", defaultHoverRenderer);
    const clickPos = renderer.viewportToGraph({ x: e.event.x, y: e.event.y });

    const collidingNode = graph.nodes().find((nodeId) => {
      if (nodeId === doubleClickTargetNode) {
        return undefined;
      }
      const attrs = graph.getNodeAttributes(nodeId);
      return Math.abs(clickPos.x - attrs.x) <= targetRange && Math.abs(clickPos.y - attrs.y) <= targetRange;
      // const distance = Math.pow(e.event.x - attrs.x, 2) + Math.pow(e.event.y - attrs.y, 2);
      // return { nodeId, distance };
    });
    // .sort((a, b) => a.distance - b.distance)
    // .find((node) => node.distance <= 100);

    console.log("node within target of click spot:", collidingNode);
    graph.dropNode(doubleClickTargetNode);
    if (collidingNode) {
      graph.addEdge(doubleClickedNode, collidingNode);
      edges.push({
        source: doubleClickedNode,
        target: collidingNode,
      });
    }
    doubleClickTargetNode = null;
    doubleClickedNode = null;
  } else {
    isDragging = true;
    draggedNode = e.node;
    graph.setNodeAttribute(draggedNode, "highlighted", true);
  }
});

renderer.on("doubleClickNode", (e) => {
  console.log("~ node double click ~");
  isDoubleClicked = true;
  doubleClickedNode = e.node;
  const coordForGraph = renderer.viewportToGraph({ x: e.event.x, y: e.event.y });

  // We create a new node
  const node = {
    ...coordForGraph,
    type: "border",
    size: node_size,
    color: "rgba(0, 0, 0)",
    draw: null,
  };
  renderer.setSetting("hoverRenderer", () => {});
  // We register the new node into graphology instance
  const id = uuid();
  graph.addNode(id, node);

  graph.addEdge(doubleClickedNode, id);

  doubleClickTargetNode = id;
});

// When clicking on the stage, we add a new node
renderer.on("clickStage", ({ event }: { event: { x: number; y: number } }) => {
  // Sigma (ie. graph) and screen (viewport) coordinates are not the same.
  // So we need to translate the screen x & y coordinates to the graph one by calling the sigma helper `viewportToGraph`
  if (isDoubleClicked) {
    isDoubleClicked = false;
    return;
  }
  const coordForGraph = renderer.viewportToGraph({ x: event.x, y: event.y });

  // We create a new node
  const node = {
    ...coordForGraph,
    size: node_size,
  };

  // We register the new node into graphology instance
  const id = uuid();
  graph.addNode(count, node);
  console.log("added node", graph.nodes());
  vertices.push({
    id: count,
  });
  count += 1;
});

// On mouse move, if the drag mode is enabled, we change the position of the draggedNode
renderer.getMouseCaptor().on("mousemovebody", (e) => {
  if (!isDragging || !draggedNode) {
    if (isDoubleClicked) {
      const pos = renderer.viewportToGraph(e);

      console.log("dragging after double click", pos);

      graph.updateNode(doubleClickTargetNode, (attr) => {
        return {
          ...attr,
          x: pos.x,
          y: pos.y,
        };
      });
    }
    return;
  }

  // Get new position of node
  const pos = renderer.viewportToGraph(e);

  graph.setNodeAttribute(draggedNode, "x", pos.x);
  graph.setNodeAttribute(draggedNode, "y", pos.y);

  // Prevent sigma to move camera:
  e.preventSigmaDefault();
  e.original.preventDefault();
  e.original.stopPropagation();
});

// On mouse up, we reset the autoscale and the dragging mode
renderer.getMouseCaptor().on("mouseup", () => {
  if (draggedNode) {
    graph.removeNodeAttribute(draggedNode, "highlighted");
  }
  isDragging = false;
  draggedNode = null;
});

// Disable the autoscale at the first down interaction
renderer.getMouseCaptor().on("mousedown", () => {
  if (!renderer.getCustomBBox()) renderer.setCustomBBox(renderer.getBBox());
});

renderer.on("enterNode", (event) => {
  graph.removeNodeAttribute(event.node, "highlight");
});
