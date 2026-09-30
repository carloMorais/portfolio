"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Decorative hero background: four small clusters in the corners of the hero
 * — the user typing, the frontend, the backend and the database — each drawn
 * over a faint icon of what it represents.
 *
 * Every phrase the user finishes typing becomes a request that hops node by
 * node down the stack and a response that hops back up:
 *   input → React → Next.js → NestJS → Prisma → PostgreSQL
 *   input → React → Next.js → NestJS → ioredis → Redis
 * Hops inside a cluster run along its mesh; hops between clusters are dots
 * only, no connecting line. A packet rests 200ms on every service it reaches,
 * which pulses. At the store
 * the packet circles for a moment (longer for PostgreSQL than for Redis)
 * before the response leaves from the store's centre.
 *
 * Dependencies (TypeScript, Node.js) are grey, with a light ambient chatter
 * towards what depends on them.
 *
 * Clusters live in the free gutters beside the content, so every node stays
 * visible. Hidden when the gutters are too narrow; static for reduced motion.
 */

export type ClusterLabels = {
  phrases: string[];
};

type ClusterId = "frontend" | "backend" | "database";
type Point = { x: number; y: number };
type GraphNode = {
  id: string;
  name: string;
  x: number;
  y: number;
  /** Label position relative to the node, and its text-anchor. */
  label: { dx: number; dy: number; anchor: "start" | "middle" | "end" };
  /** Dependencies are drawn in grey. */
  dependency?: boolean;
};

const above = { dx: 0, dy: -8, anchor: "middle" } as const;
const below = { dx: 0, dy: 15, anchor: "middle" } as const;
const right = { dx: 8, dy: 3.5, anchor: "start" } as const;

/*
 * Nodes are laid out in each cluster's own coordinates, inside its icon.
 * Receivers face whoever sends to them: React on top (the user is above),
 * Next.js on the right (towards the backend), NestJS on the left (towards the
 * frontend), the backend's data clients on top (towards the database above)
 * and the stores low (towards the backend below).
 */
const clusters: Record<ClusterId, { nodes: GraphNode[]; edges: [string, string][] }> = {
  // Inside the monitor's screen.
  frontend: {
    nodes: [
      { id: "react", name: "React", x: -6, y: -22, label: above },
      { id: "next", name: "Next.js", x: 40, y: 4, label: below },
      { id: "ts", name: "TypeScript", x: -36, y: 8, label: below, dependency: true },
    ],
    edges: [
      ["react", "next"],
      ["ts", "react"],
      ["ts", "next"],
    ],
  },
  // A Y across the racks: the data clients are the arms, NestJS the fork,
  // and Node.js (its runtime dependency) the stem.
  backend: {
    nodes: [
      { id: "prisma", name: "Prisma", x: -48, y: -37, label: right },
      { id: "ioredis", name: "ioredis", x: 20, y: -37, label: right },
      { id: "nest", name: "NestJS", x: 0, y: 0, label: right },
      { id: "node", name: "Node.js", x: 0, y: 37, label: right, dependency: true },
    ],
    edges: [
      ["nest", "prisma"],
      ["nest", "ioredis"],
      ["node", "nest"],
    ],
  },
  // Inside the cylinder: two stores, each on its own.
  database: {
    nodes: [
      { id: "postgres", name: "PostgreSQL", x: -22, y: 6, label: below },
      { id: "redis", name: "Redis", x: 28, y: 6, label: below },
    ],
    edges: [],
  },
};

const INPUT = "input";

// Request routes, one per typed phrase (alternating). Responses retrace them.
// `dwell` is how long the packet circles inside the store before returning.
// `laps` is how many turns the packet makes inside the store during that time.
type Route = { path: string[]; dwell: number; laps: number };
const routes: Route[] = [
  { path: [INPUT, "react", "next", "nest", "prisma", "postgres"], dwell: 3.5, laps: 2 },
  // Redis processes 20% faster: more turns in its 2s visit.
  { path: [INPUT, "react", "next", "nest", "ioredis", "redis"], dwell: 2, laps: 2.4 },
];

/*
 * Each route becomes a timeline of segments: moves between nodes, a short
 * pause on every service a packet reaches (both ways), and the circling
 * visit inside the store. Hops inside a cluster are quicker than hops between
 * clusters, which offsets the pauses.
 */
/*
 * Packets travel at half size on hops inside the frontend or the backend. The
 * 200ms pause on a service is where the size changes: shrinking on arrival
 * into one of those clusters, growing back before leaving it.
 */
type Timing = {
  start: number;
  duration: number;
  forward: boolean;
  scaleFrom: number;
  scaleTo: number;
};
type Segment =
  | ({ kind: "move"; from: string; to: string } & Timing)
  | ({ kind: "pause"; at: string } & Timing)
  | ({ kind: "dwell"; at: string; laps: number } & Timing);

const INTERNAL_SCALE = 0.5;
const isInternalHop = (from: string, to: string) => {
  const cluster = clusterOf.get(from);
  return cluster === clusterOf.get(to) && (cluster === "frontend" || cluster === "backend");
};

// Omit applied to each member of a union separately.
type DistributiveOmit<T, K extends PropertyKey> = T extends unknown ? Omit<T, K> : never;

export function buildTimeline({ path, dwell, laps }: Route) {
  const segments: Segment[] = [];
  let clock = 0;
  const push = (segment: DistributiveOmit<Segment, "start" | "scaleFrom" | "scaleTo">) => {
    segments.push({ ...segment, start: clock, scaleFrom: 1, scaleTo: 1 } as Segment);
    clock += segment.duration;
  };
  const move = (from: string, to: string, forward: boolean) =>
    push({
      kind: "move",
      from,
      to,
      forward,
      duration: clusterOf.get(from) === clusterOf.get(to) ? HOP_INTERNAL : HOP,
    });

  const last = path.length - 1;
  for (let i = 0; i < last; i++) {
    move(path[i], path[i + 1], true);
    if (i + 1 < last) push({ kind: "pause", at: path[i + 1], duration: PAUSE, forward: true });
  }
  push({ kind: "dwell", at: path[last], duration: dwell, laps, forward: true });
  for (let i = last; i > 0; i--) {
    move(path[i], path[i - 1], false);
    if (i - 1 > 0) push({ kind: "pause", at: path[i - 1], duration: PAUSE, forward: false });
  }

  // Moves keep one size; each pause eases from the size of the move before it
  // to the size of the move after it.
  for (const segment of segments) {
    if (segment.kind === "move") {
      const scale = isInternalHop(segment.from, segment.to) ? INTERNAL_SCALE : 1;
      segment.scaleFrom = scale;
      segment.scaleTo = scale;
    }
  }
  segments.forEach((segment, i) => {
    if (segment.kind !== "pause") return;
    segment.scaleFrom = segments[i - 1]?.scaleTo ?? 1;
    segment.scaleTo = segments[i + 1]?.scaleFrom ?? 1;
  });
  return { segments, duration: clock };
}

// Background chatter from a dependency to what depends on it.
const ambient: [string, string][] = [
  ["ts", "react"],
  ["ts", "next"],
  ["node", "nest"],
];

const clusterIds = Object.keys(clusters) as ClusterId[];
const clusterOf = new Map<string, ClusterId | "user">([[INPUT, "user"]]);
const nodeById = new Map<string, GraphNode>();
for (const id of clusterIds) {
  for (const node of clusters[id].nodes) {
    clusterOf.set(node.id, id);
    nodeById.set(node.id, node);
  }
}
const nodeIds = [...nodeById.keys()];
const isDependencyEdge = (a: string, b: string) =>
  Boolean(nodeById.get(a)?.dependency || nodeById.get(b)?.dependency);

// Timing (seconds). One phrase per cycle; its request launches once typed.
const CYCLE = 6;
const TYPE_TIME = 1.8;
const HOLD_TIME = 3;
const DELETE_TIME = 0.8;
const HOP = 1.8;
// Hops inside a cluster are 200ms quicker, making room for the pauses.
const HOP_INTERNAL = HOP - 0.2;
// How long a packet rests on each service it reaches.
const PAUSE = 0.2;
const ORBIT_RADIUS = 9;
// How far an inter-cluster hop bows (control-point offset; the curve sags half of it).
const BOW = 40;
const PACKET_RADIUS = 2.6;
// Enough slots for every request still in flight (longest route ≈ 22s).
const PACKET_SLOTS = 6;
const timelines = routes.map((route) => buildTimeline(route));

const MIN_GUTTER = 130;
const CLUSTER_HALF_WIDTH = 78;
const INPUT_HALF_WIDTH = 56;
const INPUT_TOP = 18;
const INPUT_BOTTOM = INPUT_TOP + 28;

type Layout = { width: number; height: number; centers: Record<ClusterId | "user", Point> };

function lerp(a: Point, b: Point, t: number): Point {
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}

/** Hops between clusters bow only slightly away from the content; hops inside one are straight. */
function hopPoint(from: Point, to: Point, sameCluster: boolean, layout: Layout, t: number) {
  if (sameCluster) return lerp(from, to, t);
  const mid = lerp(from, to, 0.5);
  const horizontal = Math.abs(to.x - from.x) > Math.abs(to.y - from.y);
  const control = horizontal
    ? { x: mid.x, y: Math.min(mid.y + BOW, layout.height - 8) }
    : { x: mid.x < layout.width / 2 ? mid.x - BOW / 2 : mid.x + BOW / 2, y: mid.y };
  return {
    x: (1 - t) ** 2 * from.x + 2 * (1 - t) * t * control.x + t ** 2 * to.x,
    y: (1 - t) ** 2 * from.y + 2 * (1 - t) * t * control.y + t ** 2 * to.y,
  };
}

/** Large, faint icon drawn behind a cluster to say what it represents. */
function ClusterIcon({ kind }: { kind: ClusterId | "user" }) {
  return (
    <g className="tech-graph-icon">
      {kind === "user" && (
        <>
          <circle cx={0} cy={-26} r={12} />
          <path d="M-26 12c0-15 11-23 26-23s26 8 26 23" />
        </>
      )}
      {kind === "frontend" && (
        <>
          {/* Screen (nodes live here, with some padding), chin, stand and base. */}
          <rect x={-78} y={-54} width={156} height={100} rx={9} />
          <path d="M-78 34h156" />
          <path d="M-13 46-17 60h34l-4-14" />
          <path d="M-32 60h64" />
        </>
      )}
      {kind === "backend" && (
        <>
          {[-52, -15, 22].map((y) => (
            <rect key={y} x={-70} y={y} width={140} height={30} rx={6} />
          ))}
        </>
      )}
      {kind === "database" && (
        <>
          <ellipse cx={0} cy={-36} rx={52} ry={13} />
          <path d="M-52 -36v72c0 7 23 13 52 13s52-6 52-13v-72" />
        </>
      )}
    </g>
  );
}

export function TechGraph({ labels }: { labels: ClusterLabels }) {
  const svgRef = useRef<SVGSVGElement>(null);
  const [layout, setLayout] = useState<Layout | null>(null);

  // Place the clusters in the corners of the free gutters on both sides.
  useEffect(() => {
    const svg = svgRef.current;
    const section = svg?.parentElement;
    const photo = section?.querySelector<HTMLElement>('[data-photo-slot="heroPortrait"]');
    const text = photo?.previousElementSibling;
    if (!section || !photo || !text) return;

    const measure = () => {
      const s = section.getBoundingClientRect();
      const leftGutter = text.getBoundingClientRect().left - s.left;
      const rightGutter = s.right - photo.getBoundingClientRect().right;
      if (Math.min(leftGutter, rightGutter) < MIN_GUTTER) return setLayout(null);

      const leftX = Math.max(CLUSTER_HALF_WIDTH + 8, leftGutter / 2);
      const rightX = s.width - Math.max(CLUSTER_HALF_WIDTH + 8, rightGutter / 2);
      const top = Math.max(90, s.height * 0.16);
      // The lower clusters sit ~50px under the upper band of the content.
      const bottom = Math.min(s.height - 64, s.height * 0.78 + 50);
      setLayout({
        width: s.width,
        height: s.height,
        centers: {
          user: { x: leftX, y: top },
          frontend: { x: leftX, y: bottom },
          backend: { x: rightX, y: bottom },
          database: { x: rightX, y: top },
        },
      });
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(section);
    observer.observe(photo);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || !layout) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const { phrases } = labels;

    const nodeEls = new Map(
      [...svg.querySelectorAll<SVGGElement>("[data-node]")].map((el) => [el.dataset.node!, el]),
    );
    const ringEls = new Map(
      [...svg.querySelectorAll<SVGCircleElement>("[data-ring]")].map((el) => [
        el.dataset.ring!,
        el,
      ]),
    );
    const edgeEls = [...svg.querySelectorAll<SVGLineElement>("[data-edge]")];
    const packetEls = [...svg.querySelectorAll<SVGCircleElement>("[data-packet]")];
    const chatterEls = [...svg.querySelectorAll<SVGCircleElement>("[data-chatter]")];
    const typedEl = svg.querySelector<SVGTSpanElement>("[data-typed]")!;

    let frame = 0;
    let visible = true;
    let lastTyped = "";

    const draw = (time: number) => {
      const t = reduced ? 0 : time / 1000;

      // Slow, small drift of each node around its anchor.
      const offset = new Map(
        nodeIds.map((id, i) => [
          id,
          { x: Math.sin(t * 0.22 + i * 1.9) * 2.5, y: Math.cos(t * 0.18 + i * 2.7) * 3 },
        ]),
      );
      const localPoint = (id: string): Point => {
        const node = nodeById.get(id)!;
        const o = offset.get(id)!;
        return { x: node.x + o.x, y: node.y + o.y };
      };
      const global = (id: string): Point => {
        if (id === INPUT) {
          const c = layout.centers.user;
          return { x: c.x, y: c.y + INPUT_BOTTOM };
        }
        const c = layout.centers[clusterOf.get(id) as ClusterId];
        const p = localPoint(id);
        return { x: c.x + p.x, y: c.y + p.y };
      };

      nodeEls.forEach((el, id) => {
        const o = offset.get(id)!;
        el.setAttribute("transform", `translate(${o.x} ${o.y})`);
      });
      edgeEls.forEach((el) => {
        const a = localPoint(el.dataset.a!);
        const b = localPoint(el.dataset.b!);
        el.setAttribute("x1", `${a.x}`);
        el.setAttribute("y1", `${a.y}`);
        el.setAttribute("x2", `${b.x}`);
        el.setAttribute("y2", `${b.y}`);
      });

      // Typing: type the phrase, hold, delete, move to the next one.
      const phraseIndex = Math.floor(t / CYCLE);
      const phrase = phrases[phraseIndex % phrases.length];
      const inCycle = t - phraseIndex * CYCLE;
      let chars = phrase.length;
      if (inCycle < TYPE_TIME) chars = Math.ceil((inCycle / TYPE_TIME) * phrase.length);
      else if (inCycle > TYPE_TIME + HOLD_TIME)
        chars = Math.max(
          0,
          Math.floor((1 - (inCycle - TYPE_TIME - HOLD_TIME) / DELETE_TIME) * phrase.length),
        );
      const typed = reduced ? phrases[0] : phrase.slice(0, chars);
      if (typed !== lastTyped) {
        typedEl.textContent = typed;
        lastTyped = typed;
      }

      // Requests: phrase p launches route p once typed. Each packet hops
      // forward, circles inside the store, then hops back.
      const pulse = new Map<string, number>();
      packetEls.forEach((el, slot) => {
        // Latest phrase using this slot whose request may still be in flight.
        let p =
          phraseIndex - ((((phraseIndex - slot) % PACKET_SLOTS) + PACKET_SLOTS) % PACKET_SLOTS);
        let since = t - (p * CYCLE + TYPE_TIME);
        if (since < 0) {
          p -= PACKET_SLOTS;
          since += PACKET_SLOTS * CYCLE;
        }
        const timeline = timelines[((p % routes.length) + routes.length) % routes.length];
        if (reduced || p < 0 || since >= timeline.duration) {
          el.setAttribute("opacity", "0");
          return;
        }
        const segment = timeline.segments.findLast((candidate) => candidate.start <= since)!;
        const progress = (since - segment.start) / segment.duration;

        let point: Point;
        if (segment.kind === "dwell") {
          // Circling inside the store. The radius opens from and closes back
          // to the centre, so the response leaves exactly where the request
          // arrived; the store pulses for the whole visit.
          const envelope = Math.sin(progress * Math.PI);
          const angle = progress * Math.PI * 2 * segment.laps - Math.PI / 2;
          const c = global(segment.at);
          point = {
            x: c.x + Math.cos(angle) * ORBIT_RADIUS * envelope,
            y: c.y + Math.sin(angle) * ORBIT_RADIUS * envelope,
          };
          pulse.set(segment.at, envelope);
        } else if (segment.kind === "pause") {
          // Resting on the service; its pulse fades out before the next hop.
          point = global(segment.at);
          pulse.set(segment.at, Math.max(pulse.get(segment.at) ?? 0, 1 - progress));
        } else {
          const same = clusterOf.get(segment.from) === clusterOf.get(segment.to);
          point = hopPoint(global(segment.from), global(segment.to), same, layout, progress);
          if (progress > 0.75)
            pulse.set(segment.to, Math.max(pulse.get(segment.to) ?? 0, (progress - 0.75) / 0.25));
        }
        const forward = segment.forward;
        const ease = progress * progress * (3 - 2 * progress);
        const scale = segment.scaleFrom + (segment.scaleTo - segment.scaleFrom) * ease;
        el.setAttribute("r", `${PACKET_RADIUS * scale}`);
        el.setAttribute("cx", `${point.x}`);
        el.setAttribute("cy", `${point.y}`);
        el.setAttribute("opacity", "1");
        el.setAttribute("class", forward ? "tech-graph-request" : "tech-graph-response");
      });

      // Receiving nodes pulse as a packet lands on (or circles inside) them.
      ringEls.forEach((el, id) => {
        const v = pulse.get(id) ?? 0;
        el.setAttribute("r", `${3.5 + v * 5}`);
        el.setAttribute("opacity", `${v > 0 ? 0.7 * (1 - v * 0.6) : 0}`);
      });

      // Ambient chatter from each dependency to what depends on it.
      chatterEls.forEach((el, i) => {
        const [from, to] = ambient[i];
        const k = (t / 11 + i * 0.29) % 1;
        const point = lerp(global(from), global(to), k);
        el.setAttribute("cx", `${point.x}`);
        el.setAttribute("cy", `${point.y}`);
        el.setAttribute("opacity", reduced ? "0" : `${Math.sin(k * Math.PI) * 0.85}`);
      });

      if (!reduced && visible) frame = requestAnimationFrame(draw);
    };

    const observer = new IntersectionObserver(([entry]) => {
      const wasVisible = visible;
      visible = entry.isIntersecting;
      if (visible && !wasVisible && !reduced) frame = requestAnimationFrame(draw);
    });
    observer.observe(svg);
    frame = requestAnimationFrame(draw);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
    };
  }, [layout, labels]);

  return (
    <svg
      ref={svgRef}
      aria-hidden
      data-tech-graph
      className="tech-graph pointer-events-none absolute inset-0 -z-10 h-full w-full"
      style={layout ? undefined : { display: "none" }}
    >
      {layout && (
        <>
          {/* User: a faint person icon with the input they type into just below. */}
          <g
            className="tech-graph-cluster"
            transform={`translate(${layout.centers.user.x} ${layout.centers.user.y})`}
          >
            <ClusterIcon kind="user" />
            <rect
              x={-INPUT_HALF_WIDTH}
              y={INPUT_TOP}
              width={INPUT_HALF_WIDTH * 2}
              height={28}
              rx={9}
              className="tech-graph-input"
            />
            <text x={-46} y={INPUT_TOP + 18} className="tech-graph-typing">
              <tspan data-typed>{labels.phrases[0]}</tspan>
              <tspan className="tech-graph-caret">|</tspan>
            </text>
          </g>

          {clusterIds.map((id) => {
            const center = layout.centers[id];
            const { nodes, edges } = clusters[id];
            return (
              <g
                key={id}
                className="tech-graph-cluster"
                transform={`translate(${center.x} ${center.y})`}
              >
                <ClusterIcon kind={id} />
                {edges.map(([a, b]) => (
                  <line
                    key={`${a}-${b}`}
                    data-edge
                    data-a={a}
                    data-b={b}
                    className={
                      isDependencyEdge(a, b)
                        ? "tech-graph-edge tech-graph-dependency"
                        : "tech-graph-edge"
                    }
                  />
                ))}
                {nodes.map((node) => (
                  <g key={node.id} data-node={node.id}>
                    <circle
                      data-ring={node.id}
                      cx={node.x}
                      cy={node.y}
                      r={3.5}
                      opacity={0}
                      className="tech-graph-ring"
                    />
                    <circle
                      cx={node.x}
                      cy={node.y}
                      r={3.5}
                      className={
                        node.dependency ? "tech-graph-dot tech-graph-dependency" : "tech-graph-dot"
                      }
                    />
                    <text
                      x={node.x + node.label.dx}
                      y={node.y + node.label.dy}
                      textAnchor={node.label.anchor}
                      className="tech-graph-label"
                    >
                      {node.name}
                    </text>
                  </g>
                ))}
              </g>
            );
          })}

          {/* Packets on top so they read as arriving at the nodes. */}
          {ambient.map(([from, to]) => (
            <circle key={`${from}-${to}`} data-chatter r={2.3} className="tech-graph-chatter" />
          ))}
          {Array.from({ length: PACKET_SLOTS }, (_, i) => (
            <circle
              key={i}
              data-packet
              r={PACKET_RADIUS}
              opacity={0}
              className="tech-graph-request"
            />
          ))}
        </>
      )}
    </svg>
  );
}
