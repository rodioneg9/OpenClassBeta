import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  DEFAULT_NOTEBOOK_STATE,
  clearNotebookState,
  getNotebookState,
  setNotebookState,
  type NotebookState,
  type NotebookStrokePoint
} from '../lib/notebook'
import type { ExtensionMetadata, ExtensionResult } from '../types'

interface NotebookPanelProps {
  courseId: string
  courseWorkId: string
  assignmentTitle: string
  open: boolean
  onClose: () => void
  onStateChange?: (state: NotebookState) => void
}

const deskColors: Record<NotebookState['theme'], string> = {
  light: '#d7cec4',
  dark: '#2b2f33',
  wood: '#b58a5f',
  minimal: '#d9dde1'
}

const paperColor = '#fbfaf8'
const lineColor = '#d0d7de'
const BASE_STROKE_WIDTH = 2

function drawPageBackground(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  pageStyle: NotebookState['pageStyle']
): void {
  ctx.fillStyle = paperColor
  ctx.fillRect(0, 0, width, height)
  if (pageStyle === 'blank') return
  ctx.strokeStyle = lineColor
  ctx.lineWidth = 1
  if (pageStyle === 'ruled') {
    for (let y = 30; y < height; y += 28) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
  } else {
    for (let y = 20; y < height; y += 20) {
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(width, y)
      ctx.stroke()
    }
    for (let x = 20; x < width; x += 20) {
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, height)
      ctx.stroke()
    }
  }
}

function drawStrokes(ctx: CanvasRenderingContext2D, strokes: NotebookState['strokes']): void {
  strokes.forEach((stroke) => {
    if (stroke.points.length === 0) return
    ctx.beginPath()
    ctx.moveTo(stroke.points[0].x, stroke.points[0].y)
    for (let i = 1; i < stroke.points.length; i += 1) {
      ctx.lineTo(stroke.points[i].x, stroke.points[i].y)
    }
    ctx.strokeStyle = stroke.color
    ctx.lineWidth = stroke.width
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.stroke()
  })
}

export default function NotebookPanel({
  courseId,
  courseWorkId,
  assignmentTitle,
  open,
  onClose,
  onStateChange
}: NotebookPanelProps): React.ReactElement | null {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [tool, setTool] = useState<'pen' | 'text'>('pen')
  const [drawing, setDrawing] = useState(false)
  const [textPlacement, setTextPlacement] = useState<{ x: number; y: number } | null>(null)
  const [textValue, setTextValue] = useState('')
  const [state, setState] = useState<NotebookState>(DEFAULT_NOTEBOOK_STATE)
  const [extensions, setExtensions] = useState<ExtensionMetadata[]>([])
  const [extensionResult, setExtensionResult] = useState<ExtensionResult | null>(null)
  const [canvasReady, setCanvasReady] = useState(false)
  const [statusMessage, setStatusMessage] = useState<string | null>(null)
  const strokePointsRef = useRef<NotebookStrokePoint[]>([])
  const strokeWidthRef = useRef(2)

  useEffect(() => {
    setState(getNotebookState(courseId, courseWorkId))
  }, [courseId, courseWorkId])

  useEffect(() => {
    if (!open) return
    void window.electronAPI.extensions
      .getFor('notebook')
      .then((items) => setExtensions(items as ExtensionMetadata[]))
      .catch(() => setExtensions([]))
  }, [open])

  useEffect(() => {
    if (!statusMessage) return
    const timer = window.setTimeout(() => setStatusMessage(null), 3000)
    return () => window.clearTimeout(timer)
  }, [statusMessage])

  const initializeCanvas = (nextState: NotebookState): void => {
    const canvas = canvasRef.current
    if (!canvas) return
    const rect = canvas.getBoundingClientRect()
    if (!rect.width || !rect.height) return
    const dpr = window.devicePixelRatio || 1
    canvas.width = Math.max(1, Math.floor(rect.width * dpr))
    canvas.height = Math.max(1, Math.floor(rect.height * dpr))
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    drawPageBackground(ctx, canvas.width, canvas.height, nextState.pageStyle)
    if (nextState.strokes.length > 0) {
      drawStrokes(ctx, nextState.strokes)
      setCanvasReady(true)
      return
    }
    if (!nextState.drawingDataUrl) {
      setCanvasReady(true)
      return
    }
    const img = new Image()
    img.onload = () => {
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
      setCanvasReady(true)
    }
    img.src = nextState.drawingDataUrl
  }

  useEffect(() => {
    if (!open) return
    setCanvasReady(false)
    const rerender = () => {
      initializeCanvas(state)
    }
    rerender()
    window.addEventListener('resize', rerender)
    return () => {
      window.removeEventListener('resize', rerender)
    }
  }, [open, state.pageStyle, state.drawingDataUrl, state.strokes])

  const persist = (next: NotebookState): void => {
    setState(next)
    setNotebookState(courseId, courseWorkId, next)
    onStateChange?.(next)
  }

  const updateState = (next: NotebookState, forceSave = false): void => {
    setState(next)
    if (forceSave || next.autoSave) {
      setNotebookState(courseId, courseWorkId, next)
    }
    onStateChange?.(next)
  }

  const saveCanvas = (baseState: NotebookState = state, forceSave = false): void => {
    const canvas = canvasRef.current
    if (!canvas) return
    updateState({ ...baseState, drawingDataUrl: canvas.toDataURL('image/png') }, forceSave)
  }

  const strokeColor = useMemo(() => (state.theme === 'dark' ? '#f8f9fa' : '#202124'), [state.theme])

  const getCanvasPoint = (
    canvas: HTMLCanvasElement,
    e: React.MouseEvent<HTMLCanvasElement>
  ): { x: number; y: number } => {
    const rect = canvas.getBoundingClientRect()
    const x = (e.clientX - rect.left) * (canvas.width / rect.width)
    const y = (e.clientY - rect.top) * (canvas.height / rect.height)
    return { x, y }
  }

  const insertText = (): void => {
    if (!textPlacement || !textValue.trim()) return
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.font = '16px Segoe UI'
    ctx.fillStyle = strokeColor
    ctx.fillText(textValue, textPlacement.x, textPlacement.y)
    setTextValue('')
    setTextPlacement(null)
    saveCanvas()
  }

  const saveNotebook = (): void => {
    saveCanvas(state, true)
    setStatusMessage('Notebook saved.')
  }

  const loadNotebook = (): void => {
    const loaded = getNotebookState(courseId, courseWorkId)
    setState(loaded)
    onStateChange?.(loaded)
    setStatusMessage('Notebook loaded.')
  }

  const clearNotebook = (): void => {
    const cleared: NotebookState = { ...state, drawingDataUrl: '', strokes: [], textAnswer: '' }
    persist(cleared)
    clearNotebookState(courseId, courseWorkId)
    if (cleared.autoSave) {
      setNotebookState(courseId, courseWorkId, cleared)
    }
    setStatusMessage('Notebook cleared.')
  }

  const exportNotebook = (): void => {
    const payload = JSON.stringify(
      {
        courseId,
        courseWorkId,
        assignmentTitle,
        savedAt: new Date().toISOString(),
        notebook: state
      },
      null,
      2
    )
    const blob = new Blob([payload], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${assignmentTitle || 'notebook'}-notebook.json`
    anchor.click()
    URL.revokeObjectURL(url)
    setStatusMessage('Notebook exported.')
  }

  if (!open) return null

  return (
    <div
      style={{
        width: '100%',
        border: '1px solid #d0d7de',
        borderRadius: 12,
        padding: 12,
        background: deskColors[state.theme],
        boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.25)'
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontSize: 15, fontWeight: 700 }}>Notebook · {assignmentTitle}</div>
        <button type="button" onClick={onClose}>Close</button>
      </div>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
        <button type="button" onClick={() => setTool('pen')}>Pen</button>
        <button type="button" onClick={() => setTool('text')}>Text</button>
        <button type="button" onClick={saveNotebook}>Save</button>
        <button type="button" onClick={loadNotebook}>Load</button>
        <button type="button" onClick={clearNotebook}>Clear</button>
        <button type="button" onClick={exportNotebook}>Export</button>
        <label style={{ display: 'flex', alignItems: 'center', gap: 4, fontSize: 13 }}>
          <input
            type="checkbox"
            checked={state.autoSave}
            onChange={(e) => {
              const next = { ...state, autoSave: e.target.checked }
              updateState(next, true)
            }}
          />
          Auto-save
        </label>
        <select
          value={state.pageStyle}
          onChange={(e) => updateState({ ...state, pageStyle: e.target.value as NotebookState['pageStyle'] })}
        >
          <option value="ruled">Ruled</option>
          <option value="grid">Grid</option>
          <option value="blank">Blank</option>
        </select>
        <select
          value={state.theme}
          onChange={(e) => updateState({ ...state, theme: e.target.value as NotebookState['theme'] })}
        >
          <option value="light">Light</option>
          <option value="dark">Dark</option>
          <option value="wood">Wood</option>
          <option value="minimal">Minimal</option>
        </select>
        {extensions.map((extension) => (
          <button
            key={extension.id}
            type="button"
            onClick={() => {
              void window.electronAPI.extensions
                .run(extension.id, { title: assignmentTitle, courseId, courseWorkId, notebookText: state.textAnswer })
                .then((result) => setExtensionResult(result as ExtensionResult))
                .catch(() => setExtensionResult({ summary: 'Extension failed.', hints: [] }))
            }}
          >
            {extension.name}
          </button>
        ))}
      </div>
      <div style={{ padding: 14, background: 'rgba(255,255,255,0.18)', borderRadius: 10 }}>
        <div
          style={{
            background: paperColor,
            borderRadius: 8,
            border: '1px solid #e8eaed',
            boxShadow: '0 10px 24px rgba(0,0,0,0.16)',
            padding: 10
          }}
        >
          <canvas
            ref={canvasRef}
            style={{
              border: '1px solid #dadce0',
              borderRadius: 8,
              width: '100%',
              height: 520,
              display: 'block',
              cursor: tool === 'pen' ? 'crosshair' : 'text'
            }}
            onMouseDown={(e) => {
              const canvas = canvasRef.current
              if (!canvas || !canvasReady) return
              const ctx = canvas.getContext('2d')
              if (!ctx) return
              const { x, y } = getCanvasPoint(canvas, e)
              if (tool === 'text') {
                setTextPlacement({ x, y })
                return
              }
              const deviceScale = window.devicePixelRatio || 1
              strokeWidthRef.current = Math.max(1, Math.round(BASE_STROKE_WIDTH * deviceScale))
              strokePointsRef.current = [{ x, y }]
              ctx.beginPath()
              ctx.moveTo(x, y)
              ctx.strokeStyle = strokeColor
              ctx.lineWidth = strokeWidthRef.current
              ctx.lineCap = 'round'
              ctx.lineJoin = 'round'
              setDrawing(true)
            }}
            onMouseMove={(e) => {
              if (!drawing) return
              const canvas = canvasRef.current
              if (!canvas) return
              const ctx = canvas.getContext('2d')
              if (!ctx) return
              const { x, y } = getCanvasPoint(canvas, e)
              strokePointsRef.current.push({ x, y })
              ctx.lineTo(x, y)
              ctx.stroke()
            }}
            onMouseUp={() => {
              if (drawing) {
                setDrawing(false)
                const stroke = {
                  points: [...strokePointsRef.current],
                  color: strokeColor,
                  width: strokeWidthRef.current
                }
                strokePointsRef.current = []
                saveCanvas({ ...state, strokes: [...state.strokes, stroke] })
              }
            }}
            onMouseLeave={() => {
              if (drawing) {
                setDrawing(false)
                const stroke = {
                  points: [...strokePointsRef.current],
                  color: strokeColor,
                  width: strokeWidthRef.current
                }
                strokePointsRef.current = []
                saveCanvas({ ...state, strokes: [...state.strokes, stroke] })
              }
            }}
          />
        </div>
      </div>
      {textPlacement && (
        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
          <input
            value={textValue}
            onChange={(e) => setTextValue(e.target.value)}
            placeholder={`Text at (${Math.round(textPlacement.x)}, ${Math.round(textPlacement.y)})`}
            style={{ flex: 1 }}
          />
          <button type="button" onClick={insertText}>Insert</button>
          <button
            type="button"
            onClick={() => {
              setTextPlacement(null)
              setTextValue('')
            }}
          >
            Cancel
          </button>
        </div>
      )}
      <textarea
        placeholder="Notebook text answer..."
        value={state.textAnswer}
        onChange={(e) => updateState({ ...state, textAnswer: e.target.value })}
        style={{ width: '100%', minHeight: 90, marginTop: 8 }}
      />
      {statusMessage && <div style={{ marginTop: 8, fontSize: 13 }}>{statusMessage}</div>}
      {extensionResult && (
        <div style={{ marginTop: 8, fontSize: 13 }}>
          <div>{extensionResult.summary}</div>
          {extensionResult.hints.map((hint, idx) => (
            <div key={`hint:${hint}:${idx}`}>• {hint}</div>
          ))}
        </div>
      )}
    </div>
  )
}
