import React, { useEffect, useRef } from 'react';
import Plotly from 'plotly.js-dist-min';

const GraphComponent = ({ expression, title }) => {
    const graphRef = useRef(null);

    useEffect(() => {
        if (!graphRef.current || !expression) return;

        try {
            // Generar puntos para la gráfica
            const xValues = [];
            const yValues = [];
            
            // Reemplazar ^ con ** para evaluación de JS
            // Reemplazar sin, cos, etc. con Math.sin, Math.cos
            let evalExpr = expression
                .replace(/\^/g, '**')
                .replace(/sin/g, 'Math.sin')
                .replace(/cos/g, 'Math.cos')
                .replace(/tan/g, 'Math.tan')
                .replace(/sqrt/g, 'Math.sqrt')
                .replace(/log/g, 'Math.log')
                .replace(/exp/g, 'Math.exp')
                .replace(/pi/g, 'Math.PI');

            // Rango de -10 a 10 con 200 puntos
            for (let x = -10; x <= 10; x += 0.1) {
                try {
                    // Evaluación segura (simple)
                    const func = new Function('x', `return ${evalExpr}`);
                    const y = func(x);
                    
                    if (!isNaN(y) && isFinite(y)) {
                        xValues.push(x);
                        yValues.push(y);
                    }
                } catch (e) {
                    console.error("Error evaluando punto:", e);
                }
            }

            const data = [{
                x: xValues,
                y: yValues,
                type: 'scatter',
                mode: 'lines',
                line: { color: '#4facfe', width: 3 },
                name: expression
            }];

            const layout = {
                title: title || 'Gráfica',
                paper_bgcolor: 'rgba(0,0,0,0)',
                plot_bgcolor: 'rgba(0,0,0,0)',
                font: { color: '#fff' },
                margin: { t: 40, b: 40, l: 40, r: 40 },
                xaxis: { gridcolor: '#444', zerolinecolor: '#fff' },
                yaxis: { gridcolor: '#444', zerolinecolor: '#fff' },
                autosize: true,
                height: 300
            };

            const config = { responsive: true, displayModeBar: false };

            Plotly.newPlot(graphRef.current, data, layout, config);
        } catch (error) {
            console.error("Error al graficar:", error);
        }
    }, [expression, title]);

    return (
        <div className="graph-container" style={{ 
            background: 'rgba(255, 255, 255, 0.05)', 
            borderRadius: '12px', 
            padding: '10px',
            marginTop: '15px',
            border: '1px solid rgba(255, 255, 255, 0.1)'
        }}>
            <div ref={graphRef} style={{ width: '100%' }}></div>
        </div>
    );
};

export default GraphComponent;
