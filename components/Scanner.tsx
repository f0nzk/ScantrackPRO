
import React, { useState, useEffect, useRef } from 'react';
import { Camera, X, Keyboard, ListChecks, Hash, AlertTriangle, RefreshCw } from 'lucide-react';

interface ScannerProps {
  onScan: (barcode: string) => void;
  onClose: () => void;
  title: string;
  itemCount?: number;
  lastScanned?: string | null;
  errorMsg?: string | null;
}

const Scanner: React.FC<ScannerProps> = ({ onScan, onClose, title, itemCount = 0, lastScanned, errorMsg }) => {
  const [manualInput, setManualInput] = useState('');
  const [isSuccessFlash, setIsSuccessFlash] = useState(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const scannerRef = useRef<any>(null);
  const isMounted = useRef(true);

  const playBeep = (type: 'success' | 'error' = 'success') => {
    try {
      const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioCtx.createOscillator();
      const gainNode = audioCtx.createGain();

      oscillator.type = type === 'success' ? 'sine' : 'square';
      oscillator.frequency.setValueAtTime(type === 'success' ? 880 : 110, audioCtx.currentTime); 
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);

      gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
      gainNode.gain.linearRampToValueAtTime(0.1, audioCtx.currentTime + 0.01);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + (type === 'success' ? 0.15 : 0.4));

      oscillator.start();
      oscillator.stop(audioCtx.currentTime + (type === 'success' ? 0.15 : 0.4));
    } catch (e) {
      console.warn("Audio feedback failed", e);
    }
  };

  const initScanner = async () => {
    if (!isMounted.current) return;
    setIsInitializing(true);
    setCameraError(null);
    
    if (scannerRef.current) {
      try {
        const state = scannerRef.current.getState();
        if (state === 2 || state === 'SCANNING') {
          await scannerRef.current.stop();
        }
      } catch (e) {}
    }

    const html5QrCode = new (window as any).Html5Qrcode("qr-reader");
    scannerRef.current = html5QrCode;

    const config = { 
      fps: 15, 
      qrbox: { width: 250, height: 250 },
      aspectRatio: 1.0 
    };

    try {
      await new Promise(resolve => setTimeout(resolve, 400));
      if (!isMounted.current) return;

      await html5QrCode.start(
        { facingMode: "environment" },
        config,
        (decodedText: string) => {
          playBeep('success');
          setIsSuccessFlash(true);
          onScan(decodedText);
          setTimeout(() => setIsSuccessFlash(false), 500);
        },
        () => {}
      );
      setIsInitializing(false);
    } catch (err: any) {
      if (isMounted.current) {
        setIsInitializing(false);
        console.error("Scanner start error:", err);
        if (err.toString().includes("AbortError") || err.toString().includes("Timeout")) {
          setCameraError("Camera timeout. Probeer het opnieuw.");
        } else {
          setCameraError("Camera niet beschikbaar. Controleer permissies.");
        }
      }
    }
  };

  useEffect(() => {
    isMounted.current = true;
    initScanner();

    return () => {
      isMounted.current = false;
      if (scannerRef.current) {
        try {
          const state = scannerRef.current.getState();
          if (state === 2 || state === 'SCANNING') {
            scannerRef.current.stop().catch(() => {});
          }
        } catch (e) {}
      }
    };
  }, []);

  const handleManualSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (manualInput.trim()) {
      playBeep('success');
      setIsSuccessFlash(true);
      onScan(manualInput.trim());
      setManualInput('');
      setTimeout(() => setIsSuccessFlash(false), 500);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-[#003153] flex flex-col">
      <div className="p-4 flex justify-between items-center bg-[#003153] text-white">
        <h2 className="text-lg font-bold flex items-center gap-2">
          <Camera className={`w-5 h-5 ${isSuccessFlash ? 'text-[#009FE3] animate-pulse' : ''}`} />
          {title}
        </h2>
        <button onClick={onClose} className="p-2 rounded hover:bg-white/10 active:bg-white/20">
          <X className="w-6 h-6" />
        </button>
      </div>

      <div className="flex-1 relative overflow-hidden flex flex-col bg-slate-900">
        <div id="qr-reader" className="flex-1"></div>

        {isInitializing && (
          <div className="absolute inset-0 flex items-center justify-center bg-[#003153] z-10">
            <div className="flex flex-col items-center gap-4">
              <div className="w-12 h-12 border-4 border-[#009FE3] border-t-transparent rounded-full animate-spin"></div>
              <p className="text-[#009FE3] font-bold text-xs tracking-widest uppercase">Scanner initialiseren...</p>
            </div>
          </div>
        )}

        {cameraError && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-900 z-10 p-8 text-center">
            <div className="flex flex-col items-center gap-6">
              <AlertTriangle className="w-12 h-12 text-red-500" />
              <div>
                <h3 className="text-white font-bold text-xl mb-2">Fout bij camera</h3>
                <p className="text-white/40 text-sm">{cameraError}</p>
              </div>
              <button onClick={initScanner} className="px-8 py-3 bg-[#009FE3] text-white rounded font-bold flex items-center gap-2 active:scale-95 transition-all">
                <RefreshCw className="w-5 h-5" /> OPNIEUW PROBEREN
              </button>
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="absolute inset-0 z-20 bg-red-600/90 backdrop-blur-md flex items-center justify-center p-8 animate-in fade-in zoom-in duration-200">
             <div className="flex flex-col items-center text-center">
                <AlertTriangle className="w-16 h-16 text-white mb-4" />
                <h3 className="text-2xl font-bold text-white mb-2">SCAN FOUT</h3>
                <p className="text-white text-lg font-medium">{errorMsg}</p>
             </div>
          </div>
        )}

        <div className="absolute top-4 left-0 right-0 flex justify-center gap-3 px-4 pointer-events-none z-10">
          <div className="bg-[#003153]/80 backdrop-blur px-4 py-2 rounded border border-white/10 flex items-center gap-2">
            <ListChecks className="w-4 h-4 text-[#009FE3]" />
            <span className="text-white text-xs font-bold uppercase tracking-wider">Totaal: {itemCount}</span>
          </div>
          {lastScanned && (
            <div className="bg-[#003153]/80 backdrop-blur px-4 py-2 rounded border border-white/10 flex items-center gap-2">
              <Hash className="w-4 h-4 text-green-400" />
              <span className="text-white text-xs font-bold truncate max-w-[120px]">Laatst: {lastScanned}</span>
            </div>
          )}
        </div>

        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className={`relative w-64 h-64 border-2 rounded transition-all duration-300 ${isSuccessFlash ? 'border-green-500 scale-105 shadow-[0_0_40px_rgba(34,197,94,0.4)]' : 'border-[#009FE3]/30'}`}>
            <div className={`absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 -mt-1 -ml-1 transition-colors ${isSuccessFlash ? 'border-green-500' : 'border-[#009FE3]'}`}></div>
            <div className={`absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 -mt-1 -mr-1 transition-colors ${isSuccessFlash ? 'border-green-500' : 'border-[#009FE3]'}`}></div>
            <div className={`absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 -mb-1 -ml-1 transition-colors ${isSuccessFlash ? 'border-green-500' : 'border-[#009FE3]'}`}></div>
            <div className={`absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 -mb-1 -mr-1 transition-colors ${isSuccessFlash ? 'border-green-500' : 'border-[#009FE3]'}`}></div>
          </div>
        </div>
      </div>

      <div className="p-6 bg-white safe-area-bottom">
        <form onSubmit={handleManualSubmit} className="space-y-4">
          <div className="relative">
            <input
              type="text"
              value={manualInput}
              onChange={(e) => setManualInput(e.target.value)}
              placeholder="Typ barcode handmatig..."
              className="w-full bg-slate-50 border border-slate-200 rounded px-4 py-4 text-[#003153] font-bold outline-none focus:border-[#009FE3] transition-all"
            />
            <button 
              type="submit"
              className="absolute right-2 top-2 bottom-2 bg-[#009FE3] text-white px-4 rounded font-bold hover:bg-[#0087c2] transition-colors"
            >
              VOEG TOE
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default Scanner;
