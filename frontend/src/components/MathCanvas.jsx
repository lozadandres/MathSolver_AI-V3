import { useRef, useEffect, useState, useCallback } from 'react';

const MathCanvas = ({ onSolve, onClose }) => {
  const canvasRef = useRef(null);
  const contextRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [tool, setTool] = useState('pencil'); // 'pencil', 'eraser', 'rect', 'circle', 'line', 'protractor'
  const [showGrid, setShowGrid] = useState(false);
  const [smartMode, setSmartMode] = useState(false);
  const [startPos, setStartPos] = useState({ x: 0, y: 0 });
  const [snapshot, setSnapshot] = useState(null);
  const [currentPath, setCurrentPath] = useState([]);
  const [angleInfo, setAngleInfo] = useState(null); // Para el transportador
  const [isThinking, setIsThinking] = useState(false);

  const drawGrid = (ctx, width, height) => {
    ctx.save();
    ctx.beginPath();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 0.5;
    const gridSize = 30;
    for (let x = 0; x <= width; x += gridSize) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += gridSize) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();
    ctx.restore();
  };

  const initCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const context = contextRef.current;
    if (!canvas || !context) return;

    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    if (showGrid) {
      drawGrid(context, canvas.width / 2, canvas.height / 2);
    }
  }, [showGrid]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * 2;
    canvas.height = rect.height * 2;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;

    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.scale(2, 2);
    context.lineCap = 'round';
    context.strokeStyle = '#000000';
    context.lineWidth = 3;
    contextRef.current = context;

    initCanvas();
  }, [initCanvas]);

  useEffect(() => {
    if (contextRef.current) {
      initCanvas();
    }
  }, [showGrid, initCanvas]);

  const startDrawing = ({ nativeEvent }) => {
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    
    // Guardar snapshot para previsualización de formas o corrección Smart
    if (['rect', 'circle', 'line', 'triangle', 'protractor'].includes(tool) || (tool === 'pencil' && smartMode)) {
      setSnapshot(contextRef.current.getImageData(0, 0, canvasRef.current.width, canvasRef.current.height));
      setStartPos({ x: offsetX, y: offsetY });
    }

    if (tool === 'pencil' && smartMode) {
      setCurrentPath([{ x: offsetX, y: offsetY }]);
    }

    contextRef.current.beginPath();
    contextRef.current.moveTo(offsetX, offsetY);
    
    // Configurar estilo según herramienta
    contextRef.current.strokeStyle = tool === 'eraser' ? '#ffffff' : '#000000';
    contextRef.current.lineWidth = tool === 'eraser' ? 20 : 3;
    
    setIsDrawing(true);
  };

  const draw = ({ nativeEvent }) => {
    if (!isDrawing) return;
    const { offsetX, offsetY } = getCoordinates(nativeEvent);
    const ctx = contextRef.current;

    if (['rect', 'circle', 'line', 'triangle', 'protractor'].includes(tool)) {
      ctx.putImageData(snapshot, 0, 0);
      ctx.beginPath();
      
      if (tool === 'rect') {
        ctx.strokeRect(startPos.x, startPos.y, offsetX - startPos.x, offsetY - startPos.y);
      } else if (tool === 'line') {
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
      } else if (tool === 'circle') {
        const radius = Math.sqrt(Math.pow(offsetX - startPos.x, 2) + Math.pow(offsetY - startPos.y, 2));
        ctx.arc(startPos.x, startPos.y, radius, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (tool === 'triangle') {
        ctx.beginPath();
        // Dibujar triángulo rectángulo basado en caja
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(startPos.x, offsetY);
        ctx.lineTo(offsetX, offsetY);
        ctx.closePath();
        ctx.stroke();
      } else if (tool === 'protractor') {
        // Dibujar línea base y arco de ángulo
        ctx.setLineDash([5, 5]);
        ctx.strokeStyle = '#6366f1';
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
        
        // Línea horizontal de referencia
        ctx.moveTo(startPos.x, startPos.y);
        ctx.lineTo(startPos.x + 100, startPos.y);
        ctx.stroke();
        ctx.setLineDash([]);

        // Calcular ángulo
        const angle = Math.atan2(offsetY - startPos.y, offsetX - startPos.x) * (180 / Math.PI);
        const displayAngle = Math.abs(Math.round(angle < 0 ? angle + 360 : angle));
        setAngleInfo({ x: offsetX, y: offsetY, value: displayAngle });
        
        // Dibujar arco
        ctx.beginPath();
        ctx.arc(startPos.x, startPos.y, 40, 0, angle * (Math.PI / 180), angle < 0);
        ctx.stroke();
      }
    } else {
      ctx.lineTo(offsetX, offsetY);
      ctx.stroke();
      if (tool === 'pencil' && smartMode) {
        setCurrentPath(prev => [...prev, { x: offsetX, y: offsetY }]);
      }
    }
  };

  const stopDrawing = () => {
    if (isDrawing) {
      const ctx = contextRef.current;
      ctx.closePath();
      
      if (tool === 'pencil' && smartMode && currentPath.length > 10) {
        applySmartShapes();
      }
      
      setIsDrawing(false);
      setSnapshot(null);
      setAngleInfo(null);
    }
  };

  const applySmartShapes = async () => {
    if (currentPath.length < 5) return;
    const ctx = contextRef.current;
    
    const first = currentPath[0];
    const last = currentPath[currentPath.length - 1];
    const dist = Math.sqrt(Math.pow(first.x - last.x, 2) + Math.pow(first.y - last.y, 2));
    
    const minX = Math.min(...currentPath.map(p => p.x));
    const maxX = Math.max(...currentPath.map(p => p.x));
    const minY = Math.min(...currentPath.map(p => p.y));
    const maxY = Math.max(...currentPath.map(p => p.y));
    
    const width = maxX - minX;
    const height = maxY - minY;
    const centerX = minX + width / 2;
    const centerY = minY + height / 2;
    const bboxArea = width * height;
    
    let polyArea = 0;
    for (let i = 0; i < currentPath.length; i++) {
      const p1 = currentPath[i];
      const p2 = currentPath[(i + 1) % currentPath.length];
      polyArea += (p1.x * p2.y) - (p2.x * p1.y);
    }
    polyArea = Math.abs(polyArea) / 2;
    
    const areaRatio = polyArea / bboxArea;

    // Detectar si el trazo es una línea recta (Heurística de linealidad)
    const isLine = dist > 60 && currentPath.length < 25;

    // Lógica para disparar la Inteligencia Artificial (Visión)
    // Disparamos si:
    // 1. El dibujo tiene una complejidad mínima (más de 15 puntos)
    // 2. No es una línea recta obvia
    // 3. El área ratio no es la de un rectángulo/círculo perfecto (para dar paso a la IA en casos ambiguos)
    const isPerfectRect = areaRatio > 0.95;
    
    // Si no es una forma primitiva obvia, consultamos a la IA para números, letras u objetos
    if (currentPath.length > 15 && !isLine && !isPerfectRect) {
      setIsThinking(true);
      try {
        const canvas = canvasRef.current;
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
        const formData = new FormData();
        formData.append('file', blob);

        const response = await fetch('http://localhost:3000/api/beautify', {
          method: 'POST',
          body: formData
        });
        
        const data = await response.json();
        
        if (data.action === 'draw' && snapshot) {
          ctx.putImageData(snapshot, 0, 0);
          ctx.strokeStyle = '#000000';
          ctx.lineWidth = 3;
          
          if (data.type === 'circle') {
             ctx.beginPath();
             ctx.arc(centerX, centerY, (width + height) / 4, 0, 2 * Math.PI);
             ctx.stroke();
          } else if (data.type === 'triangle') {
             ctx.beginPath();
             ctx.moveTo(centerX, minY);
             ctx.lineTo(minX, maxY);
             ctx.lineTo(maxX, maxY);
             ctx.closePath();
             ctx.stroke();
          } else if (data.type === 'rect') {
             ctx.strokeRect(minX, minY, width, height);
          }
          
          if (data.label) {
             ctx.font = 'bold 20px "Segoe UI", Tahoma, Geneva, Verdana, sans-serif';
             ctx.fillStyle = '#6366f1';
             ctx.fillText(`✨ ${data.label}`, minX, minY - 15);
          }
          setCurrentPath([]);
          setIsThinking(false);
          return;
        }
      } catch (err) {
        console.error("AI Beautify failed:", err);
      } finally {
        setIsThinking(false);
      }
    }

    // Fallback a heurística local si falla la IA o el dibujo es muy simple
    if (snapshot) ctx.putImageData(snapshot, 0, 0);
    
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 3;

    if (isLine) {
      ctx.beginPath();
      ctx.moveTo(first.x, first.y);
      ctx.lineTo(last.x, last.y);
      ctx.stroke();
    } else {
      // Solo aplicar heurísticas básicas si no se usó la IA
      if (areaRatio < 0.2) {
        setCurrentPath([]);
        return;
      }

      if (areaRatio < 0.65) {
        // TRIÁNGULO
        const pts = [...currentPath];
        const p1 = pts.reduce((max, p) => 
          Math.hypot(p.x - centerX, p.y - centerY) > Math.hypot(max.x - centerX, max.y - centerY) ? p : max, pts[0]);
        const p2 = pts.reduce((max, p) => 
          Math.hypot(p.x - p1.x, p.y - p1.y) > Math.hypot(max.x - p1.x, max.y - p1.y) ? p : max, pts[0]);
        const p3 = pts.reduce((max, p) => {
          const d = Math.abs((p2.y - p1.y) * p.x - (p2.x - p1.x) * p.y + p2.x * p1.y - p2.y * p1.x) / 
                       Math.hypot(p2.y - p1.y, p2.x - p1.x);
          return d > max.dist ? { ...p, dist: d } : max;
        }, { ...pts[0], dist: 0 });

        ctx.beginPath();
        ctx.moveTo(p1.x, p1.y);
        ctx.lineTo(p2.x, p2.y);
        ctx.lineTo(p3.x, p3.y);
        ctx.closePath();
        ctx.stroke();
      } else if (areaRatio < 0.82) {
        ctx.beginPath();
        ctx.arc(centerX, centerY, (width + height) / 4, 0, 2 * Math.PI);
        ctx.stroke();
      } else if (areaRatio >= 0.82 && areaRatio <= 1.1) {
        ctx.strokeRect(minX, minY, width, height);
      }
    }
    
    setCurrentPath([]);
  };

  const getCoordinates = (nativeEvent) => {
    if (nativeEvent.type.startsWith('touch')) {
      const touch = nativeEvent.touches[0];
      const rect = canvasRef.current.getBoundingClientRect();
      return {
        offsetX: touch.clientX - rect.left,
        offsetY: touch.clientY - rect.top
      };
    }
    return {
      offsetX: nativeEvent.offsetX,
      offsetY: nativeEvent.offsetY
    };
  };

  const clearCanvas = () => {
    initCanvas();
  };

  const handleSolveAction = () => {
    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], 'whiteboard_drawing.png', { type: 'image/png' });
        onSolve(file);
      }
    }, 'image/png');
  };

  return (
    <div className="math-canvas-overlay">
      <div className="math-canvas-container">
        <div className="canvas-header">
          <h3>Pizarra de MathSolver</h3>
          <button className="close-canvas" onClick={onClose}>✕</button>
        </div>
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
           className={`drawing-canvas cursor-${tool}`}
        />
        {isThinking && (
          <div className="ai-thinking-indicator">
            <span className="sparkle">✨</span> Interpretando dibujo...
          </div>
        )}
        {angleInfo && (
          <div 
            className="angle-tooltip"
            style={{ left: angleInfo.x + 10, top: angleInfo.y - 30 }}
          >
            {angleInfo.value}°
          </div>
        )}
        <div className="canvas-footer">
          <div className="tools">
            <button 
              className={`tool-btn ${tool === 'pencil' ? 'active' : ''}`} 
              onClick={() => setTool('pencil')}
              title="Lápiz"
            >
              ✏️
            </button>
            <button 
              className={`tool-btn ${tool === 'eraser' ? 'active' : ''}`} 
              onClick={() => setTool('eraser')}
              title="Borrador"
            >
              🧽
            </button>
            <button 
              className={`tool-btn ${tool === 'line' ? 'active' : ''}`} 
              onClick={() => setTool('line')}
              title="Línea"
            >
              📏
            </button>
            <button 
              className={`tool-btn ${tool === 'rect' ? 'active' : ''}`} 
              onClick={() => setTool('rect')}
              title="Rectángulo"
            >
              Rect
            </button>
            <button 
              className={`tool-btn ${tool === 'circle' ? 'active' : ''}`} 
              onClick={() => setTool('circle')}
              title="Círculo"
            >
              Circ
            </button>
            <button 
              className={`tool-btn ${tool === 'triangle' ? 'active' : ''}`} 
              onClick={() => setTool('triangle')}
              title="Triángulo"
            >
              Tri
            </button>
            <button 
              className={`tool-btn ${tool === 'protractor' ? 'active' : ''}`} 
              onClick={() => setTool('protractor')}
              title="Transportador"
            >
              📐
            </button>
            <button 
              className={`tool-btn ${smartMode ? 'active' : ''}`} 
              onClick={() => setSmartMode(!smartMode)}
              title="Modo Inteligente (Auto-formas)"
            >
              ✨ AI
            </button>
            <button 
              className={`tool-btn ${showGrid ? 'active' : ''}`} 
              onClick={() => setShowGrid(!showGrid)}
              title="Alternar cuadrícula"
            >
              {showGrid ? '✅' : '⏹️'}
            </button>
            <button className="tool-btn" onClick={clearCanvas} title="Limpiar todo">
              🗑️
            </button>
          </div>
          <button className="solve-canvas-btn" onClick={handleSolveAction}>
            🚀 Resolver Dibujo
          </button>
        </div>
      </div>
    </div>
  );
};

export default MathCanvas;
