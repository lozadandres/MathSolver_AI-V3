import { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkMath from 'remark-math';
import rehypeKatex from 'rehype-katex';
import remarkGfm from 'remark-gfm';
import 'katex/dist/katex.min.css';
import GraphComponent from './GraphComponent';
import html2pdf from 'html2pdf.js';
import MathCanvas from './MathCanvas';
import '../styles/ChatBox.css';

const ChatBox = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [mode, setMode] = useState('detallado');
  const [language, setLanguage] = useState('es');
  const [isLoading, setIsLoading] = useState(false);
  const [selectedFile, setSelectedFile] = useState(null);
  const [previewUrl, setPreviewUrl] = useState(null);
  const [isCanvasOpen, setIsCanvasOpen] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  const [showDesmos, setShowDesmos] = useState(false);
  const [desmosExpr, setDesmosExpr] = useState("");
  const messagesEndRef = useRef(null);
  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Función para desplazarse al último mensaje
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const extractGraphData = (text) => {
    if (typeof text !== 'string') return null;
    const match = text.match(/\[GRAPH:\s*({[\s\S]*?})\]/s);
    if (match) {
      try {
        return JSON.parse(match[1]);
      } catch {
        return null;
      }
    }
    return null;
  };

  const cleanText = (text) => {
    if (typeof text !== 'string') return '';
    return text.replace(/\[GRAPH:\s*({[\s\S]*?})\]/gs, '').trim();
  };

  // Normaliza cualquier respuesta del servidor a string legible
  const normalizeResponse = (data) => {
    if (typeof data === 'string') return data;
    if (data && typeof data === 'object') {
      if (data.error) return `⚠️ Error del servidor: ${data.error}`;
      return JSON.stringify(data);
    }
    return String(data);
  };

  const openDesmos = (expr) => {
    setDesmosExpr(expr);
    setShowDesmos(true);
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Función para manejar la selección de archivo
  const handleFileSelect = (e) => {
    const file = e.target.files[0];
    if (file) {
      setSelectedFile(file);
      // Crear preview si es imagen
      if (file.type.startsWith('image/')) {
        const reader = new FileReader();
        reader.onload = (e) => setPreviewUrl(e.target.result);
        reader.readAsDataURL(file);
      } else {
        setPreviewUrl(null);
      }
    }
  };

  // Función para cancelar archivo seleccionado
  const handleCancelFile = () => {
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // Función para enviar mensaje al backend
  const sendMessage = async (e) => {
    e.preventDefault();
    if (isLoading || (input.trim() === '' && !selectedFile)) return;

    // Agregar mensaje del usuario al chat
    const userMessage = { 
      type: 'user', 
      content: input || '(Archivo adjunto)',
      file: selectedFile ? { name: selectedFile.name, preview: previewUrl } : null
    };
    setMessages(prev => [...prev, userMessage]);
    
    const messageText = input;
    const fileToSend = selectedFile;
    
    setInput('');
    setSelectedFile(null);
    setPreviewUrl(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    setIsLoading(true);

    try {
      let response;
      
      // Si hay archivo, usar FormData
      if (fileToSend) {
        const formData = new FormData();
        formData.append('message', messageText);
        formData.append('mode', mode);
        formData.append('lang', language);
        formData.append('file', fileToSend);
        
        response = await fetch('http://localhost:3000/api/chat-with-file', {
          method: 'POST',
          body: formData,
        });
      } else {
        // Sin archivo, usar JSON
        response = await fetch('http://localhost:3000/api/chat', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({ message: messageText, mode: mode, lang: language }),
        });
      }

      if (!response.ok) {
        throw new Error('Error en la comunicación con el servidor');
      }

      // Procesar respuesta
      const data = await response.json();
      
      // Agregar respuesta del asistente al chat
      const botMessage = { type: 'bot', content: normalizeResponse(data) };
      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      // Mostrar mensaje de error en el chat
      const errorMessage = { type: 'bot', content: `⚠️ Error de conexión: ${error.message}` };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };
  
  // Función para descargar un mensaje en PDF
  const handleDownloadPDF = (index) => {
    const element = document.getElementById(`message-${index}`);
    if (!element) return;
    
    // Crear un clon para el PDF para poder limpiar elementos UI si es necesario
    const clone = element.cloneNode(true);
    
    // Aplicar estilos específicos para el PDF (fondo blanco, texto negro)
    clone.style.color = '#000000';
    clone.style.backgroundColor = '#ffffff';
    clone.style.padding = '20px';
    clone.style.borderRadius = '0';
    clone.style.border = 'none';
    
    // Asegurar que todos los descendientes también tengan texto negro si es necesario
    const allText = clone.querySelectorAll('*');
    allText.forEach(el => {
      el.style.color = '#000000';
      if (el.tagName === 'TH') {
        el.style.backgroundColor = '#f1f5f9';
      }
    });
    
    // Opcional: Eliminar el botón de descarga del clon para que no aparezca en el PDF
    const downloadBtn = clone.querySelector('.download-pdf-btn');
    if (downloadBtn) downloadBtn.remove();
    
    const opt = {
      margin:       10,
      filename:    `MathSolver_Respuesta_${index + 1}.pdf`,
      image:        { type: 'jpeg', quality: 0.98 },
      html2canvas:  { scale: 2, useCORS: true, backgroundColor: '#ffffff' },
      jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    html2pdf().from(clone).set(opt).save();
  };
  
  // Función para compartir o copiar el mensaje
  const handleShare = async (content) => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'Respuesta de MathSolver AI',
          text: content,
          url: window.location.href
        });
      } catch (err) {
        console.error('Error al compartir:', err);
      }
    } else {
      // Fallback: Copiar al portapapeles
      try {
        await navigator.clipboard.writeText(content);
        alert('Copiado al portapapeles');
      } catch (err) {
        console.error('Error al copiar:', err);
      }
    }
  };

  // Función para manejar la resolución desde la pizarra
  const handleSolveFromCanvas = async (file) => {
    setIsCanvasOpen(false);
    
    // Simular el flujo de envío de archivo
    const userMessage = { 
      type: 'user', 
      content: 'Dibujo de la pizarra',
      file: { name: 'Pizarra.png', preview: URL.createObjectURL(file) }
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('message', 'Por favor, resuelve el problema matemático que aparece en este dibujo hecho a mano. Explica el proceso paso a paso.');
      formData.append('mode', mode);
      formData.append('lang', language);
      formData.append('file', file);
      
      const response = await fetch('http://localhost:3000/api/chat-with-file', {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Error en el servidor');
      const data = await response.json();
      const botMessage = { type: 'bot', content: normalizeResponse(data) };
      setMessages(prevMessages => [...prevMessages, botMessage]);
    } catch (error) {
      console.error('Error:', error);
      const errorMessage = { type: 'bot', content: `⚠️ Error al procesar el dibujo: ${error.message}` };
      setMessages(prevMessages => [...prevMessages, errorMessage]);
    } finally {
      setIsLoading(false);
    }
  };

  // Función auxiliar para enviar mensaje sin evento sintético
  const handleSendMessage = () => {
    const fakeEvent = { preventDefault: () => {} };
    sendMessage(fakeEvent);
  };

  // Función para reproducir un sonido sutil de confirmación
  const playFeedbackSound = () => {
    try {
      const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(880, audioCtx.currentTime); // La (A5)
      oscillator.frequency.exponentialRampToValueAtTime(440, audioCtx.currentTime + 0.1);

      gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.2);

      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + 0.2);
    } catch (e) {
      console.error('Error al reproducir sonido:', e);
    }
  };

  // Función para normalizar el habla matemática a notación formal (LaTeX)
  const normalizeMathSpeech = (text) => {
    let result = text.toLowerCase();

    // Mapeo de números en palabras a dígitos
    const numMap = {
      'uno': '1', 'una': '1', 'dos': '2', 'tres': '3', 'cuatro': '4',
      'cinco': '5', 'seis': '6', 'siete': '7', 'ocho': '8', 'nueve': '9', 'diez': '10'
    };

    Object.keys(numMap).forEach(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'g');
      result = result.replace(regex, numMap[word]);
    });

    // Normalizar variables
    result = result.replace(/equis/g, 'x');
    result = result.replace(/ye/g, 'y');
    result = result.replace(/zeta/g, 'z');

    // Cálculo (LaTeX formal)
    result = result.replace(/derivada de|derivada/g, '\\frac{d}{dx}(');
    result = result.replace(/integral de|integral/g, '\\int (');
    result = result.replace(/límite de|límites de|límite|límites/g, '\\lim_{x \\to 0}(');
    result = result.replace(/derivada parcial/g, '\\partial/');

    // Álgebra y Exponentes
    result = result.replace(/(?:elevado\s+)?a\s+la\s+(\d+)/g, '^$1');
    result = result.replace(/al\s+cuadrado/g, '^2');
    result = result.replace(/al\s+cubo/g, '^3');
    result = result.replace(/raíz\s+cuadrada\s+de|raíz\s+cuadrada/g, '\\sqrt{');

    // Trigonometría
    result = result.replace(/seno\s+de|seno/g, '\\sin(');
    result = result.replace(/coseno\s+de|coseno/g, '\\cos(');
    result = result.replace(/tangente\s+de|tangente/g, '\\tan(');

    // Operadores
    result = result.replace(/más/g, '+');
    result = result.replace(/menos/g, '-');
    result = result.replace(/por|multiplicado\s+por/g, '\\cdot');
    result = result.replace(/dividido\s+entre|dividido\s+por|sobre/g, '/');
    result = result.replace(/es\s+igual\s+a|igual\s+a/g, '=');
    result = result.replace(/pi/g, '\\pi');
    
    // Gestión de Paréntesis y Llaves
    result = result.replace(/paréntesis/g, '(');
    result = result.replace(/cierra\s+paréntesis|cerrar\s+paréntesis/g, ')');

    // Si detectamos comandos LaTeX, envolver en $ para que ReactMarkdown lo tome como math
    if (result.includes('\\') || result.includes('^') || result.includes('∫')) {
      // Evitar doble envoltura
      if (!result.startsWith('$')) {
        // Intentar autocompletar cierres simples de llaves/paréntesis para el preview
        const opens = (result.match(/\{/g) || []).length;
        const closes = (result.match(/\}/g) || []).length;
        if (opens > closes) result += '}'.repeat(opens - closes);
        
        const opensP = (result.match(/\(/g) || []).length;
        const closesP = (result.match(/\)/g) || []).length;
        if (opensP > closesP) result += ')'.repeat(opensP - closesP);

        result = `$${result}$`;
      }
    }

    // Limpieza de palabras clave de envío para que no ensucien el prompt
    const sendKeywords = ['enviar', 'envié', 'manda', 'enviarlo', 'send it', 'send', 'resolver', 'listo', 'procesar', 'ejecutar', 'okay', 'ya'];
    sendKeywords.forEach(kw => {
        const regex = new RegExp(`\\b${kw}\\b`, 'gi');
        result = result.replace(regex, '');
    });

    result = result.replace(/\s+/g, ' ');
    return result.trim();
  };

  // Configuración de Reconocimiento de Voz
  const startVoiceCommand = () => {
    if (isListening) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      return;
    }

    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Tu navegador no soporta reconocimiento de voz.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = language === 'es' ? 'es-ES' : 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;

    recognition.onstart = () => {
      setIsListening(true);
    };
    
    recognition.onend = () => {
      setIsListening(false);
      recognitionRef.current = null;
    };

    recognition.onerror = (event) => {
      console.error('Error de voz:', event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      let finalTranscript = '';

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        const transcript = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      // Actualizar el input con el texto final + el intermedio para feedback visual
      if (finalTranscript || interimTranscript) {
        const currentText = (finalTranscript + interimTranscript);
        const lowText = currentText.toLowerCase();
        
        // Detección más flexible de comandos de envío
        const sendKeywords = ['enviar', 'envié', 'manda', 'enviarlo', 'send it', 'send', 'resolver', 'listo', 'procesar', 'ejecutar', 'okay', 'ya'];
        const foundKeyword = sendKeywords.find(kw => lowText.includes(kw));

        // GUARD: No enviar si ya está cargando o si ya procesamos un comando de envío en esta ráfaga
        if (foundKeyword && !isLoading) {
            recognition.stop(); // Esto disparará onend y pondrá isListening en false
            
            const normalized = normalizeMathSpeech(currentText);
            if (normalized) setInput(normalized);
            
            // Retroalimentación auditiva
            playFeedbackSound();

            // Pequeña pausa para asegurar que el input se actualizó y evitar colisión
            setTimeout(() => {
                handleSendMessage();
            }, 100);
        } else if (!isLoading) {
            setInput(normalizeMathSpeech(currentText));
        }
      }
    };

    recognition.start();
  };



  return (
    <div className="chat-layout">
      {/* Overlay para cerrar sidebar en móvil */}
      {isSidebarOpen && (
        <div className="sidebar-overlay" onClick={() => setIsSidebarOpen(false)}></div>
      )}

      <aside className={`chat-sidebar ${isSidebarOpen ? 'open' : ''}`}>
        <div className="sidebar-header">
          <h2>MathSolver AI</h2>
        </div>
        <div className="sidebar-content">
          <div className="history-section">
            <span className="section-title">NUEVO CHAT</span>
            <button className="new-chat-btn" onClick={() => setMessages([])}>
              <span>+</span> Nuevo Problema
            </button>
          </div>
          <div className="mode-section">
            <span className="section-title">MODO DE RESPUESTA</span>
            <div className="mode-options">
              <button 
                type="button" 
                className={mode === 'rápido' ? 'active' : ''} 
                onClick={() => setMode('rápido')}
              >
                ⚡ Rápido
              </button>
              <button 
                type="button" 
                className={mode === 'detallado' ? 'active' : ''} 
                onClick={() => setMode('detallado')}
              >
                📚 Detallado
              </button>
              <button 
                className={`mode-btn ${mode === 'quiz' ? 'active' : ''}`} 
                onClick={() => setMode('quiz')}
              >
                <span className="mode-icon">🧠</span> Quiz
              </button>
            </div>
          </div>

          <div className="sidebar-section">
            <h3 className="sidebar-title">IDIOMA / LANGUAGE</h3>
            <div className="lang-selector">
              <button 
                className={`lang-btn ${language === 'es' ? 'active' : ''}`} 
                onClick={() => setLanguage('es')}
              >
                🇪🇸 ES
              </button>
              <button 
                className={`lang-btn ${language === 'en' ? 'active' : ''}`} 
                onClick={() => setLanguage('en')}
              >
                🇺🇸 EN
              </button>
            </div>
          </div>
        </div>
        <div className="sidebar-footer">
          <div className="user-profile">
            <span className="user-avatar">👤</span>
            <span className="user-name">Usuario</span>
          </div>
        </div>
      </aside>

      <main className="chat-main">
        <div className="chat-header-mobile">
          <button 
            className="hamburger-btn" 
            onClick={() => setIsSidebarOpen(true)}
            aria-label="Abrir menú"
          >
            ☰
          </button>
          <h2>MathSolver AI</h2>
        </div>
        
        <div className="messages-container">
          {messages.length === 0 ? (
            <div className="welcome-screen">
              <div className="welcome-card">
                <h1>¿En qué puedo ayudarte hoy?</h1>
                <p>MathSolver AI utiliza inteligencia artificial para brindarte soluciones precisas y detalladas.</p>
                <div className="suggestion-grid">
                  <button onClick={() => setInput('¿Cómo resolver ecuaciones y problemas matemáticos?')}>
                    Resolver ecuaciones y problemas
                  </button>
                  <button onClick={() => setInput('¿Puedes explicarme conceptos de álgebra, cálculo y geometría?')}>
                    Explicar conceptos matemáticos
                  </button>
                  <button onClick={() => setInput('¿Me puedes dar un ejemplo paso a paso?')}>
                    Ejemplos paso a paso
                  </button>
                  <button onClick={() => setInput('¿Puedes explicarme teoremas y fórmulas matemáticas?')}>
                    Teoremas y fórmulas
                  </button>
                </div>
                <div className="whiteboard-promotion">
                  <button className="promo-canvas-btn" onClick={() => setIsCanvasOpen(true)}>
                    🎨 Abrir Pizarra para Dibujar Problema
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="messages-list">
              {messages.map((msg, index) => (
                <div key={index} className={`message-wrapper ${msg.type}`}>
                  <div className="message-icon">
                    {msg.type === 'user' ? '👤' : '🤖'}
                  </div>
                    <div className="message-bubble" id={`message-${index}`}>
                      <ReactMarkdown 
                        remarkPlugins={[remarkMath, remarkGfm]} 
                        rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                      >
                        {msg.type === 'bot' ? cleanText(String(msg.content)) : String(msg.content)}
                      </ReactMarkdown>

                      {msg.type === 'bot' && extractGraphData(msg.content) && (
                        <div className="message-graph-container">
                          <GraphComponent 
                            expression={extractGraphData(msg.content).expression}
                            title={extractGraphData(msg.content).title}
                          />
                          <button 
                            className="explore-desmos-btn"
                            onClick={() => openDesmos(extractGraphData(msg.content).expression)}
                          >
                            🔍 Explorar en Desmos
                          </button>
                        </div>
                      )}

                      {msg.type === 'bot' && (
                        <div className="bot-actions">
                          <button 
                            className="action-btn share-btn" 
                            onClick={() => handleShare(msg.content)}
                            title="Compartir o copiar"
                          >
                            🔗 Compartir
                          </button>
                          <button 
                            className="action-btn download-pdf-btn" 
                            onClick={() => handleDownloadPDF(index)}
                            title="Descargar como PDF"
                          >
                            📥 PDF
                          </button>
                        </div>
                      )}
                    </div>
                </div>
              ))}
              {isLoading && (
                <div className="message-wrapper bot">
                  <div className="message-icon">🤖</div>
                  <div className="message-bubble loading">
                    <div className="typing-indicator">
                      <span></span>
                      <span></span>
                      <span></span>
                    </div>
                  </div>
                </div>
              )}
              <div ref={messagesEndRef} />
            </div>
          )}
        </div>
        
        <div className="input-section">
          {input && (
            <div className="math-live-preview">
              <span className="preview-label">Vista previa matemática:</span>
              <div className="preview-content">
                <ReactMarkdown 
                  remarkPlugins={[remarkMath, remarkGfm]} 
                  rehypePlugins={[[rehypeKatex, { strict: false, throwOnError: false }]]}
                >
                  {input}
                </ReactMarkdown>
              </div>
            </div>
          )}
          {selectedFile && (
            <div className="file-preview-container">
              <div className="file-preview">
                {previewUrl ? (
                  <img src={previewUrl} alt="Preview" className="preview-image" />
                ) : (
                  <div className="file-icon">📄</div>
                )}
                <span className="file-name">{selectedFile.name}</span>
                <button type="button" className="remove-file-btn" onClick={handleCancelFile}>
                  ✕
                </button>
              </div>
            </div>
          )}
          <form className="input-wrapper" onSubmit={sendMessage}>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*,.pdf,.doc,.docx"
              onChange={handleFileSelect}
              style={{ display: 'none' }}
            />
            <button 
              type="button" 
              className={`voice-btn ${isListening ? 'listening' : ''}`}
              onClick={startVoiceCommand}
              disabled={isLoading}
              title="Dictar problema"
            >
              {isListening ? '🛑' : '🎤'}
            </button>
            <button 
              type="button" 
              className="attach-btn"
              onClick={() => fileInputRef.current?.click()}
              disabled={isLoading}
              title="Adjuntar archivo"
            >
              📎
            </button>
            <button 
              type="button" 
              className="canvas-toggle-btn"
              onClick={() => setIsCanvasOpen(true)}
              disabled={isLoading}
              title="Dibujar problema"
            >
              🎨
            </button>
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Haz una pregunta de matemáticas..."
              disabled={isLoading}
            />
            <button type="submit" className="send-btn" disabled={isLoading || (input.trim() === '' && !selectedFile)}>
              {isLoading ? '...' : '→'}
            </button>
          </form>
          <p className="input-footer">MathSolver AI puede cometer errores. Verifica la información importante.</p>
        </div>
      </main>

      {isCanvasOpen && (
        <MathCanvas 
          onSolve={handleSolveFromCanvas} 
          onClose={() => setIsCanvasOpen(false)} 
        />
      )}

      {showDesmos && (
        <div className="desmos-modal-overlay" onClick={() => setShowDesmos(false)}>
          <div className="desmos-modal-content" onClick={e => e.stopPropagation()}>
            <div className="desmos-modal-header">
              <h3>Calculadora Gráfica Desmos</h3>
              <button 
                className="close-modal-btn"
                onClick={() => setShowDesmos(false)}
              >
                ✕
              </button>
            </div>
            <div className="desmos-iframe-container">
              <iframe
                title="Desmos Graphing Calculator"
                src={`https://www.desmos.com/calculator?lang=es&expression=${encodeURIComponent(desmosExpr)}`}
                width="100%"
                height="100%"
                frameBorder="0"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBox;