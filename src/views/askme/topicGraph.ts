// D3 graph: the library in the centre, its topics on a fixed ring around it.
// Positions are deterministic, so the picture is the same every time. Clicking a topic opens its timeline.
import * as d3 from 'd3'
import type { Topic } from './askmeData'

const HEIGHT = 560
const OK = '#16a34a'
const ATTENTION = '#d97706'

interface GraphNode {
  id: string
  kind: 'center' | 'topic'
  title: string
  count: number
  issues: number
  r: number
  x: number
  y: number
}

export function createTopicGraph(opts: {
  stage: HTMLDivElement
  svgEl: SVGSVGElement
  tip: HTMLDivElement
  centerTitle: string
  topics: Topic[]
  callbacks: { current: { onOpenTopic: (id: string) => void } }
}) {
  const { stage, svgEl, tip, centerTitle, topics, callbacks } = opts
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  const svg = d3.select(svgEl)
  svg.selectAll('*').remove()
  const gLinks = svg.append('g')
  const gNodes = svg.append('g')
  let opening = false
  stage.style.height = `${HEIGHT}px`

  const total = topics.reduce((n, t) => n + t.docs.length, 0)
  const nodes: GraphNode[] = [
    { id: '__center', kind: 'center', title: centerTitle, count: total, issues: 0, r: 46, x: 0, y: 0 },
    ...topics.map((t): GraphNode => ({
      id: t.id,
      kind: 'topic',
      title: t.title,
      count: t.docs.length,
      issues: t.issues,
      r: 26 + Math.sqrt(t.docs.length) * 6,
      x: 0,
      y: 0,
    })),
  ]

  function layout(W: number) {
    const cx = W / 2
    const cy = HEIGHT / 2 - 16
    const rx = Math.min(W / 2 - 110, 330)
    const ry = HEIGHT / 2 - 92
    nodes[0].x = cx
    nodes[0].y = cy
    nodes.slice(1).forEach((n, i, all) => {
      const a = -Math.PI / 2 + (i / all.length) * Math.PI * 2
      n.x = cx + Math.cos(a) * rx
      n.y = cy + Math.sin(a) * ry
    })
  }

  let W = Math.max(360, stage.clientWidth)
  layout(W)
  svg.attr('viewBox', `0 0 ${W} ${HEIGHT}`)

  const linkSel = gLinks
    .selectAll('line')
    .data(nodes.slice(1))
    .join('line')
    .attr('class', 'askme-link')

  const nodeSel = gNodes
    .selectAll<SVGGElement, GraphNode>('g')
    .data(nodes, (d) => d.id)
    .join((enter) => {
      const g = enter.append('g').attr('class', (d) => `askme-node askme-${d.kind}`)
      g.append('circle').attr('class', 'askme-bubble').attr('r', (d) => d.r)
      g.filter((d) => d.kind === 'topic')
        .append('circle')
        .attr('class', 'askme-health')
        .attr('r', 5)
        .attr('cx', (d) => d.r * 0.7)
        .attr('cy', (d) => -d.r * 0.7)
        .attr('fill', (d) => (d.issues ? ATTENTION : OK))
      g.append('text')
        .attr('class', 'askme-count')
        .attr('dy', '0.35em')
        .text((d) => String(d.count))
      g.append('text')
        .attr('class', 'askme-node-label')
        .attr('y', (d) => d.r + 20)
        .text((d) => d.title)
      g.append('text')
        .attr('class', 'askme-node-sub')
        .attr('y', (d) => d.r + 37)
        .classed('attention', (d) => d.kind === 'topic' && d.issues > 0)
        .text((d) =>
          d.kind === 'center' ? '' : d.issues ? `${d.issues} ${d.issues === 1 ? 'aandachtspunt' : 'aandachtspunten'}` : 'op orde',
        )
      return g
    })

  function place() {
    linkSel
      .attr('x1', nodes[0].x)
      .attr('y1', nodes[0].y)
      .attr('x2', (d) => d.x)
      .attr('y2', (d) => d.y)
    nodeSel.attr('transform', (d) => `translate(${d.x},${d.y})`)
  }
  place()

  // Fade in once; no movement afterwards.
  nodeSel
    .style('opacity', 0)
    .transition()
    .duration(reduced ? 0 : 400)
    .delay((_d, i) => (reduced ? 0 : i * 40))
    .style('opacity', 1)

  nodeSel
    .filter((d) => d.kind === 'topic')
    .attr('tabindex', 0)
    .attr('role', 'button')
    .attr('aria-label', (d) => `${d.title}: ${d.count} documenten, ${d.issues ? `${d.issues} aandachtspunten` : 'op orde'}. Open de tijdlijn.`)
    .on('mouseenter', function (e: MouseEvent, d) {
      d3.select(this).classed('hover', true)
      const title = document.createElement('div')
      title.className = 'askme-tip-title'
      title.textContent = d.title
      const sub = document.createElement('div')
      sub.textContent = `${d.count} documenten · klik om de tijdlijn te openen`
      tip.replaceChildren(title, sub)
      tip.style.opacity = '1'
      moveTip(e)
    })
    .on('mousemove', moveTip)
    .on('mouseleave', function () {
      d3.select(this).classed('hover', false)
      tip.style.opacity = '0'
    })
    .on('click', (_e: MouseEvent, d) => open(d))
    .on('keydown', (e: KeyboardEvent, d) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault()
        open(d)
      }
    })

  function open(d: GraphNode) {
    if (opening) return
    opening = true
    tip.style.opacity = '0'
    const dur = reduced ? 0 : 220
    nodeSel.filter((n) => n.id !== d.id).transition().duration(dur).style('opacity', 0.15)
    linkSel.transition().duration(dur).style('opacity', 0)
    window.setTimeout(() => callbacks.current.onOpenTopic(d.id), dur)
  }

  function moveTip(e: MouseEvent) {
    const r = stage.getBoundingClientRect()
    let left = e.clientX - r.left + 14
    if (left + tip.offsetWidth > r.width - 8) left = e.clientX - r.left - tip.offsetWidth - 14
    tip.style.left = `${left}px`
    tip.style.top = `${e.clientY - r.top + 14}px`
  }

  let resizeTimer: number | undefined
  const ro = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer)
    resizeTimer = window.setTimeout(() => {
      const w = Math.max(360, stage.clientWidth)
      if (w === W) return
      W = w
      svg.attr('viewBox', `0 0 ${W} ${HEIGHT}`)
      layout(W)
      place()
    }, 120)
  })
  ro.observe(stage)

  return {
    destroy() {
      ro.disconnect()
      window.clearTimeout(resizeTimer)
      stage.style.height = ''
      svg.selectAll('*').interrupt().remove()
    },
  }
}
