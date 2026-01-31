
import React, { useState, useEffect, useCallback } from 'react';
import { 
  Plus, 
  History, 
  ArrowLeft, 
  Scan,
  X,
  Settings,
  Trash2,
  Info,
  ChevronRight,
  Database,
  RotateCcw,
  AlertCircle,
  LayoutDashboard,
  MapPin,
  PackageOpen,
  CheckCircle,
  Package,
  Lock,
  Eye,
  EyeOff,
  Key,
  Clock,
  Truck,
  Save,
  Check,
  // Added RefreshCw import to fix compilation error
  RefreshCw
} from 'lucide-react';
import { TransportBox, BoxStatus, ItemStatus, Item, View, Location } from './types';
import Scanner from './components/Scanner';
import BoxCard from './components/BoxCard';
import { db, supabase } from './services/supabase';

const App: React.FC = () => {
  const [boxes, setBoxes] = useState<TransportBox[]>([]);
  const [locations, setLocations] = useState<Location[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isAddingLoc, setIsAddingLoc] = useState(false);
  const [dbError, setDbError] = useState<string | null>(null);
  
  const [currentView, setCurrentView] = useState<View>('DASHBOARD');
  const [selectedBoxId, setSelectedBoxId] = useState<string | null>(null);
  const [scannerMode, setScannerMode] = useState<'NEW_BOX' | 'ADD_ITEM' | 'RECEIVE_BOX' | null>(null);
  const [showLocationPicker, setShowLocationPicker] = useState(false);
  const [tempLocation, setTempLocation] = useState<string | null>(null);
  const [lastScannedBarcode, setLastScannedBarcode] = useState<string | null>(null);
  const [scannerError, setScannerError] = useState<string | null>(null);
  const [newLocName, setNewLocName] = useState('');
  
  // Auth state
  const [adminPassword, setAdminPassword] = useState('0000');
  const [tempPassword, setTempPassword] = useState('0000');
  const [showPass, setShowPass] = useState(false);
  const [isSavingPass, setIsSavingPass] = useState(false);
  const [passSaveSuccess, setPassSaveSuccess] = useState(false);
  
  // Action state
  const [passwordModal, setPasswordModal] = useState<{
    isOpen: boolean;
    type: 'DELETE' | 'REVERT' | null;
    targetStatus?: BoxStatus;
  }>({ isOpen: false, type: null });
  const [enteredPassword, setEnteredPassword] = useState('');
  const [passError, setPassError] = useState(false);

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setIsLoading(true);
    setDbError(null);
    try {
      const [fetchedBoxes, fetchedLocs, fetchedPass] = await Promise.all([
        db.getBoxes(),
        db.getLocations(),
        db.getSetting('admin_password', '0000')
      ]);
      setBoxes(fetchedBoxes);
      setLocations(fetchedLocs);
      setAdminPassword(fetchedPass);
      setTempPassword(fetchedPass);
    } catch (err: any) {
      if (err.message?.includes('scantrack_boxes')) setDbError('DATABASE_NOT_INITIALIZED');
      else setDbError(err.message || 'Onbekende fout');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const channel = supabase.channel('db-changes').on('postgres_changes', { event: '*', schema: 'public' }, () => fetchData(true)).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [fetchData]);

  const handleSavePassword = async () => {
    setIsSavingPass(true);
    try {
      await db.updateSetting('admin_password', tempPassword);
      setAdminPassword(tempPassword);
      setPassSaveSuccess(true);
      setTimeout(() => setPassSaveSuccess(false), 3000);
    } catch (err) {
      alert("Kon wachtwoord niet opslaan.");
    } finally {
      setIsSavingPass(false);
    }
  };

  const startNewBoxWorkflow = (locationName: string) => {
    setTempLocation(locationName);
    setScannerMode('NEW_BOX');
    setShowLocationPicker(false);
  };

  const handleScan = useCallback(async (barcode: string) => {
    setLastScannedBarcode(barcode);
    setScannerError(null);
    
    if (scannerMode === 'NEW_BOX') {
      const isActive = await db.checkActiveBoxExists(barcode);
      if (isActive) {
        setScannerError(`BOX ${barcode} IS AL ACTIEF`);
        setTimeout(() => setScannerError(null), 3500);
        return;
      }
      try {
        const newBox = await db.createBox({ barcode, status: BoxStatus.ACTIVE, startLocation: tempLocation || 'Onbekend' });
        await fetchData(true);
        if (newBox) { 
          setSelectedBoxId(newBox.id); 
          setCurrentView('BOX_DETAIL'); 
        }
        setScannerMode(null);
      } catch (err: any) { alert(err.message); }
    } else if (scannerMode === 'ADD_ITEM' && selectedBoxId) {
      const itemExists = await db.checkItemExists(barcode);
      if (itemExists) {
        setScannerError(`ITEM ${barcode} IS AL GESCANND`);
        setTimeout(() => setScannerError(null), 3500);
        return;
      }
      try {
        await db.addItemToBox(selectedBoxId, { barcode, status: ItemStatus.SCANNED });
        await fetchData(true);
      } catch (err: any) { alert(err.message); }
    } else if (scannerMode === 'RECEIVE_BOX') {
      const boxToReceive = boxes.find(b => b.barcode === barcode && b.status !== BoxStatus.RECEIVED);
      if (!boxToReceive) {
        setScannerError(`BOX ${barcode} NIET GEVONDEN`);
        setTimeout(() => setScannerError(null), 3500);
        return;
      }
      try {
        await db.updateBoxStatus(boxToReceive.id, BoxStatus.RECEIVED);
        await fetchData(true);
        setSelectedBoxId(boxToReceive.id);
        setCurrentView('BOX_DETAIL');
        setScannerMode(null);
      } catch (err: any) { alert(err.message); }
    }
  }, [scannerMode, selectedBoxId, boxes, tempLocation, fetchData]);

  const deleteItem = async (itemId: string) => {
    if (!confirm("Item verwijderen uit deze box?")) return;
    try {
      await db.deleteItem(itemId);
      await fetchData(true);
    } catch (err: any) { alert(err.message); }
  };

  const executeAction = async () => {
    if (enteredPassword !== adminPassword) {
      setPassError(true);
      setTimeout(() => setPassError(false), 2000);
      return;
    }

    const { type, targetStatus } = passwordModal;
    if (!selectedBoxId) return;

    try {
      setIsLoading(true);
      if (type === 'DELETE') {
        await db.deleteBox(selectedBoxId);
        setSelectedBoxId(null);
        setCurrentView('DASHBOARD');
      } else if (type === 'REVERT' && targetStatus) {
        await db.updateBoxStatus(selectedBoxId, targetStatus);
      }
      
      await fetchData(true);
      setPasswordModal({ isOpen: false, type: null });
      setEnteredPassword('');
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenPasswordModal = (type: 'DELETE' | 'REVERT') => {
    const box = boxes.find(b => b.id === selectedBoxId);
    if (!box) return;

    let targetStatus: BoxStatus | undefined;
    if (type === 'REVERT') {
      switch (box.status) {
        case BoxStatus.RECEIVED: targetStatus = BoxStatus.IN_TRANSIT; break;
        case BoxStatus.IN_TRANSIT: targetStatus = BoxStatus.SEALED; break;
        case BoxStatus.SEALED: targetStatus = BoxStatus.ACTIVE; break;
        default: return;
      }
    }

    setPasswordModal({ isOpen: true, type, targetStatus });
  };

  const selectedBox = boxes.find(b => b.id === selectedBoxId);

  const formatDateTime = (ts?: number) => {
    if (!ts) return null;
    return new Intl.DateTimeFormat('nl-NL', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).format(ts);
  };

  const renderPasswordModal = () => {
    if (!passwordModal.isOpen) return null;
    const isDelete = passwordModal.type === 'DELETE';
    
    return (
      <div className="fixed inset-0 z-[110] bg-[#003153]/90 backdrop-blur-md flex items-center justify-center p-6 animate-in fade-in duration-200">
        <div className="bg-white w-full max-w-sm rounded shadow-2xl overflow-hidden scale-100 animate-in zoom-in-95">
          <div className={`p-6 ${isDelete ? 'bg-red-50' : 'bg-blue-50'} border-b flex justify-between items-center`}>
            <h3 className={`text-lg font-bold ${isDelete ? 'text-red-700' : 'text-[#003153]'}`}>
              {isDelete ? 'Box Verwijderen' : 'Status Terugzetten'}
            </h3>
            <button onClick={() => setPasswordModal({ isOpen: false, type: null })} className="text-slate-400 hover:text-slate-900">
              <X className="w-6 h-6" />
            </button>
          </div>
          <div className="p-8 space-y-6">
            <div className="flex flex-col items-center text-center">
              <div className={`w-14 h-14 rounded-full flex items-center justify-center mb-4 ${isDelete ? 'bg-red-100 text-red-600' : 'bg-blue-100 text-[#009FE3]'}`}>
                {isDelete ? <Trash2 className="w-6 h-6" /> : <RotateCcw className="w-6 h-6" />}
              </div>
              <p className="text-sm text-slate-500 font-medium">
                {isDelete 
                  ? 'Weet u zeker dat u deze box en alle inhoud wilt verwijderen?' 
                  : 'Voer het wachtwoord in om de status van deze box terug te zetten.'}
              </p>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-bold uppercase text-slate-400 tracking-widest">Wachtwoord</label>
              <div className="relative">
                <input 
                  type="password"
                  value={enteredPassword}
                  onChange={(e) => setEnteredPassword(e.target.value)}
                  autoFocus
                  className={`w-full bg-slate-50 border ${passError ? 'border-red-500 animate-shake' : 'border-slate-200'} rounded px-4 py-3 font-bold outline-none focus:border-[#009FE3]`}
                  placeholder="••••"
                  onKeyDown={(e) => e.key === 'Enter' && executeAction()}
                />
                <Key className="absolute right-3 top-1/2 -translate-y-1/2 w-5 h-5 text-slate-300" />
              </div>
              {passError && <p className="text-[10px] text-red-500 font-bold">Wachtwoord is onjuist</p>}
            </div>

            <button 
              onClick={executeAction}
              className={`w-full py-4 rounded font-bold text-white shadow-sm transition-all active:scale-95 ${isDelete ? 'bg-red-600 hover:bg-red-700' : 'bg-[#003153] hover:bg-slate-800'}`}
            >
              BEVESTIGEN
            </button>
          </div>
        </div>
      </div>
    );
  };

  const renderDashboard = () => (
    <div className="p-6 md:p-12 space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 border-b border-slate-200 pb-6">
        <div>
          <h1 className="text-3xl font-bold text-[#003153] tracking-tight">Logistiek Overzicht</h1>
          <p className="text-slate-500 font-medium">Beheer transportboxen en zendingen</p>
        </div>
        <div className="flex gap-2">
          <button 
            onClick={() => setShowLocationPicker(true)} 
            className="bg-[#009FE3] hover:bg-[#0087c2] text-white px-6 py-3 rounded-md font-bold flex items-center gap-2 shadow-sm transition-all active:scale-95"
          >
            <Plus className="w-5 h-5" /> NIEUWE BOX
          </button>
          <button 
            onClick={() => setScannerMode('RECEIVE_BOX')} 
            className="bg-white border border-slate-200 text-[#003153] px-6 py-3 rounded-md font-bold flex items-center gap-2 hover:bg-slate-50 transition-all shadow-sm"
          >
            <History className="w-5 h-5" /> ONTVANGEN
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        {boxes.map(box => <BoxCard key={box.id} box={box} onClick={() => { setSelectedBoxId(box.id); setCurrentView('BOX_DETAIL'); }} />)}
        {boxes.length === 0 && !isLoading && (
          <div className="col-span-full py-20 text-center bg-white rounded-lg border border-slate-200 shadow-sm">
            <PackageOpen className="w-12 h-12 text-slate-200 mx-auto mb-4" />
            <p className="text-slate-400 font-bold">Er zijn momenteel geen actieve zendingen.</p>
          </div>
        )}
      </div>
    </div>
  );

  const renderBoxDetail = () => {
    if (!selectedBox) return null;

    const timeline = [
      { label: 'Aangemaakt', status: BoxStatus.ACTIVE, ts: selectedBox.createdAt, icon: <Plus className="w-3 h-3" /> },
      { label: 'Verzegeld', status: BoxStatus.SEALED, ts: selectedBox.sealedAt, icon: <Lock className="w-3 h-3" /> },
      { label: 'In Transport', status: BoxStatus.IN_TRANSIT, ts: selectedBox.inTransitAt, icon: <Truck className="w-3 h-3" /> },
      { label: 'Ontvangen', status: BoxStatus.RECEIVED, ts: selectedBox.receivedAt, icon: <CheckCircle className="w-3 h-3" /> },
    ].filter(item => item.ts);

    return (
      <div className="flex flex-col lg:flex-row w-full min-h-[calc(100vh-80px)] animate-in fade-in slide-in-from-right-8 duration-500">
        <div className="lg:w-[400px] border-r border-slate-200 bg-white p-8 flex flex-col shadow-sm overflow-y-auto">
           <button onClick={() => setCurrentView('DASHBOARD')} className="flex items-center gap-2 text-[#009FE3] font-bold hover:underline mb-8">
             <ArrowLeft className="w-4 h-4" /> Terug naar overzicht
           </button>
           
           <div className="flex-1 space-y-8">
             <div className="bg-slate-50 p-6 rounded-lg border border-slate-100">
               <p className="text-[#009FE3] font-bold text-[10px] uppercase tracking-widest mb-1">{selectedBox.startLocation}</p>
               <h1 className="text-2xl font-bold text-[#003153] break-all leading-tight">{selectedBox.barcode}</h1>
               <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-white rounded border border-slate-200 text-xs font-bold text-slate-600">
                  <span className="w-2 h-2 rounded-full bg-[#009FE3]"></span>
                  {selectedBox.status}
               </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-[10px] font-bold text-slate-400 uppercase tracking-widest border-b border-slate-100 pb-2">Status Historie</h3>
                <div className="space-y-6 relative ml-2">
                   {timeline.map((step, idx) => (
                      <div key={idx} className="relative pl-6">
                         {idx !== timeline.length - 1 && (
                            <div className="absolute left-[7px] top-[14px] bottom-[-24px] w-[2px] bg-slate-100"></div>
                         )}
                         <div className="absolute left-0 top-1 w-4 h-4 rounded-full bg-blue-50 border border-[#009FE3] flex items-center justify-center text-[#009FE3] z-10">
                            {step.icon}
                         </div>
                         <div className="flex flex-col">
                            <span className="text-xs font-bold text-[#003153] leading-none">{step.label}</span>
                            <span className="text-[10px] text-slate-400 font-medium mt-1">{formatDateTime(step.ts)}</span>
                         </div>
                      </div>
                   ))}
                </div>
             </div>

             <div className="space-y-3">
               {selectedBox.status === BoxStatus.ACTIVE && (
                 <button onClick={() => setScannerMode('ADD_ITEM')} className="w-full py-4 bg-[#009FE3] text-white rounded font-bold shadow-sm flex items-center justify-center gap-2 active:scale-90 transition-all">
                   <Scan className="w-5 h-5" /> SCAN ITEMS
                 </button>
               )}
               
               {selectedBox.status !== BoxStatus.RECEIVED && (
                 <button 
                  onClick={async () => {
                    const nextStatus = selectedBox.status === BoxStatus.ACTIVE ? BoxStatus.SEALED : 
                                       selectedBox.status === BoxStatus.SEALED ? BoxStatus.IN_TRANSIT : BoxStatus.RECEIVED;
                    await db.updateBoxStatus(selectedBox.id, nextStatus);
                    await fetchData(true);
                  }}
                  className="w-full py-4 bg-[#003153] text-white rounded font-bold flex items-center justify-center gap-2 shadow-sm active:scale-95 transition-all"
                 >
                   {selectedBox.status === BoxStatus.ACTIVE ? "BOX VERZEGELEN" : 
                    selectedBox.status === BoxStatus.SEALED ? "START TRANSPORT" : "BOX ONTVANGEN"}
                 </button>
               )}
               
               {selectedBox.status !== BoxStatus.ACTIVE && (
                 <button onClick={() => handleOpenPasswordModal('REVERT')} className="w-full py-4 border border-slate-200 text-[#003153] rounded font-bold flex items-center justify-center gap-2 hover:bg-slate-50 transition-all active:scale-95">
                    <RotateCcw className="w-4 h-4" /> STATUS TERUGZETTEN
                 </button>
               )}
             </div>
           </div>

           <div className="mt-auto pt-8 border-t border-slate-100">
              <button onClick={() => handleOpenPasswordModal('DELETE')} className="w-full py-4 text-red-500 font-bold flex items-center justify-center gap-2 hover:bg-red-50 rounded transition-colors active:scale-95">
                 <Trash2 className="w-4 h-4" /> VERWIJDER BOX
              </button>
           </div>
        </div>

        <div className="flex-1 p-8 bg-slate-50 overflow-y-auto">
          <div className="max-w-4xl">
            <div className="flex items-center justify-between mb-8 border-b border-slate-200 pb-4">
              <h2 className="text-xl font-bold text-[#003153]">Inhoud van de box ({selectedBox.items.length})</h2>
              {selectedBox.status !== BoxStatus.ACTIVE && (
                <div className="flex items-center gap-2 text-[10px] font-bold text-orange-600 uppercase bg-orange-50 border border-orange-100 px-4 py-2 rounded">
                  <AlertCircle className="w-3 h-3" /> Bewerken uitgeschakeld
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {selectedBox.items.map(item => (
                <div key={item.id} className="bg-white p-5 rounded-lg border border-slate-200 flex items-center justify-between shadow-sm group">
                  <div>
                    <p className="font-mono font-bold text-[#003153] text-base">{item.barcode}</p>
                    <p className="text-[10px] text-slate-400 font-bold uppercase mt-1">Gescand: {new Date(item.timestamp).toLocaleTimeString()}</p>
                  </div>
                  {selectedBox.status === BoxStatus.ACTIVE ? (
                    <button onClick={() => deleteItem(item.id)} className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded transition-all">
                      <Trash2 className="w-5 h-5" />
                    </button>
                  ) : (
                    <CheckCircle className="w-5 h-5 text-[#009FE3]" />
                  )}
                </div>
              ))}
              {selectedBox.items.length === 0 && (
                <div className="col-span-full py-20 text-center text-slate-400 bg-white rounded-lg border border-slate-200 border-dashed">
                  <Package className="w-8 h-8 mx-auto mb-2 opacity-20" />
                  <p className="font-medium italic">Nog geen items gescand in deze box.</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderSettings = () => (
    <div className="p-8 md:p-12 max-w-4xl mx-auto w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      <div className="flex items-center gap-4 mb-10 border-b border-slate-200 pb-6">
        <button onClick={() => setCurrentView('DASHBOARD')} className="p-2 text-[#009FE3] border border-slate-200 rounded bg-white shadow-sm">
          <ArrowLeft className="w-6 h-6" />
        </button>
        <h2 className="text-3xl font-bold text-[#003153]">Instellingen</h2>
      </div>

      <div className="space-y-10">
        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
           <div className="flex items-center gap-3 mb-6">
             <div className="p-2 bg-blue-50 text-[#009FE3] rounded-lg"><Lock className="w-5 h-5" /></div>
             <h3 className="text-lg font-bold text-[#003153]">Beveiliging</h3>
           </div>
           
           <div className="max-w-md space-y-4">
              <div>
                <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-2">Beheerderswachtwoord</label>
                <div className="relative">
                   <input 
                      type={showPass ? "text" : "password"}
                      value={tempPassword}
                      onChange={(e) => setTempPassword(e.target.value)}
                      className="w-full bg-slate-50 text-[#003153] border border-slate-200 rounded px-4 py-3 font-bold outline-none focus:border-[#009FE3]"
                   />
                   <button 
                      onClick={() => setShowPass(!showPass)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400"
                   >
                      {showPass ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                   </button>
                </div>
              </div>
              
              <button 
                onClick={handleSavePassword}
                disabled={isSavingPass || tempPassword === adminPassword}
                className={`flex items-center gap-2 px-6 py-3 rounded font-bold transition-all shadow-sm ${
                  passSaveSuccess ? 'bg-green-600 text-white' : 
                  tempPassword !== adminPassword ? 'bg-[#009FE3] text-white active:scale-95' : 'bg-slate-100 text-slate-400'
                }`}
              >
                {isSavingPass ? <RefreshCw className="w-4 h-4 animate-spin" /> : 
                 passSaveSuccess ? <Check className="w-4 h-4" /> : <Save className="w-4 h-4" />}
                {passSaveSuccess ? 'OPGESLAGEN' : 'WACHTWOORD OPSLAAN'}
              </button>
           </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-slate-200 p-8">
          <label className="block text-[10px] font-bold uppercase tracking-widest text-slate-500 mb-4">Nieuwe Locatie Toevoegen</label>
          <div className="flex gap-4">
            <input 
              type="text" 
              value={newLocName}
              onChange={(e) => setNewLocName(e.target.value)}
              placeholder="Bijv. Locatie A"
              className="flex-1 bg-slate-50 text-slate-900 border border-slate-200 rounded px-6 py-4 font-bold outline-none focus:border-[#009FE3] focus:bg-white transition-all"
              disabled={isAddingLoc}
            />
            <button 
              onClick={async () => {
                const trimmedName = newLocName.trim();
                if (!trimmedName) return;
                setIsAddingLoc(true);
                try {
                  await db.addLocation(trimmedName);
                  setNewLocName('');
                  await fetchData(true);
                } catch (err: any) { alert(err.message); }
                finally { setIsAddingLoc(false); }
              }}
              disabled={isAddingLoc || !newLocName.trim()}
              className="bg-[#009FE3] text-white px-8 rounded font-bold shadow-sm flex items-center gap-2 hover:bg-[#0087c2] transition-colors"
            >
              {isAddingLoc ? <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin"></div> : <Plus className="w-5 h-5" />}
              TOEVOEGEN
            </button>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-8">
            {locations.map(loc => (
              <div key={loc.id} className="flex items-center justify-between p-4 rounded bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <MapPin className="w-4 h-4 text-[#009FE3]" />
                  <span className="font-bold text-[#003153]">{loc.name}</span>
                </div>
                <button onClick={async () => {
                  if (!confirm("Weet je zeker dat je deze locatie wilt verwijderen?")) return;
                  try { await db.deleteLocation(loc.id); await fetchData(true); } catch (err: any) { alert(err.message); }
                }} className="p-2 text-slate-300 hover:text-red-500 transition-all">
                  <Trash2 className="w-5 h-5" />
                </button>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <nav className="h-20 bg-[#003153] flex items-center justify-between px-8 sticky top-0 z-40 shadow-md">
        <div className="flex items-center gap-4 cursor-pointer" onClick={() => setCurrentView('DASHBOARD')}>
          <div className="w-10 h-10 bg-white rounded flex items-center justify-center"><Scan className="w-6 h-6 text-[#009FE3]" /></div>
          <div className="flex flex-col">
            <span className="text-lg font-bold text-white tracking-tight leading-none uppercase">ScanTrack</span>
            <span className="text-[10px] font-bold text-[#009FE3] uppercase tracking-[0.2em] leading-none mt-1">Pro</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <button onClick={() => setCurrentView('DASHBOARD')} className={`p-3 rounded transition-colors ${currentView === 'DASHBOARD' ? 'bg-[#009FE3] text-white' : 'text-white/60 hover:text-white'}`}>
            <LayoutDashboard className="w-6 h-6" />
          </button>
          <button onClick={() => setCurrentView('SETTINGS')} className={`p-3 rounded transition-colors ${currentView === 'SETTINGS' ? 'bg-[#009FE3] text-white' : 'text-white/60 hover:text-white'}`}>
            <Settings className="w-6 h-6" />
          </button>
        </div>
      </nav>

      <main className="flex-1 flex flex-col overflow-x-hidden">
        {isLoading && boxes.length === 0 ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="w-12 h-12 border-4 border-[#009FE3] border-t-transparent rounded-full animate-spin"></div>
          </div>
        ) : (
          <>
            {currentView === 'DASHBOARD' ? renderDashboard() : 
             currentView === 'BOX_DETAIL' ? renderBoxDetail() : 
             currentView === 'SETTINGS' ? renderSettings() : null}
          </>
        )}
      </main>

      {renderPasswordModal()}

      {currentView === 'DASHBOARD' && (
        <div className="fixed bottom-10 right-10 z-50 flex flex-col gap-4">
           <button onClick={() => setShowLocationPicker(true)} className="w-16 h-16 bg-[#009FE3] text-white rounded-full flex items-center justify-center shadow-2xl active:scale-90 transition-transform">
             <Plus className="w-8 h-8" />
           </button>
        </div>
      )}

      {showLocationPicker && (
        <div className="fixed inset-0 z-[100] bg-[#003153]/80 backdrop-blur-sm flex items-center justify-center p-6 animate-in fade-in duration-200">
          <div className="bg-white w-full max-w-sm rounded shadow-2xl scale-100 animate-in zoom-in-95 duration-200 overflow-hidden">
            <div className="p-6 bg-slate-50 border-b border-slate-200 flex justify-between items-center">
              <h2 className="text-xl font-bold text-[#003153]">Kies Locatie</h2>
              <button onClick={() => setShowLocationPicker(false)} className="p-2 text-slate-400 hover:text-slate-900"><X className="w-6 h-6" /></button>
            </div>
            <div className="p-4 space-y-2 max-h-80 overflow-y-auto">
              {locations.map(loc => (
                <button key={loc.id} onClick={() => startNewBoxWorkflow(loc.name)} className="w-full p-4 text-left border border-slate-200 rounded hover:border-[#009FE3] hover:bg-slate-50 font-bold text-[#003153] flex justify-between items-center group transition-all">
                  {loc.name} <ChevronRight className="w-4 h-4 text-[#009FE3] opacity-0 group-hover:opacity-100" />
                </button>
              ))}
              {locations.length === 0 && (
                <div className="text-center py-6">
                   <p className="text-slate-400 text-sm mb-4 italic">Geen locaties geconfigureerd.</p>
                   <button onClick={() => { setShowLocationPicker(false); setCurrentView('SETTINGS'); }} className="text-[#009FE3] font-bold text-xs underline">LOCATIES BEHEREN</button>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {scannerMode && (
        <Scanner 
          title={scannerMode === 'NEW_BOX' ? "Scan Nieuwe Box" : scannerMode === 'RECEIVE_BOX' ? "Ontvangst Scannen" : "Item Scannen"} 
          onScan={handleScan} 
          onClose={() => { setScannerMode(null); setScannerError(null); }} 
          lastScanned={lastScannedBarcode}
          itemCount={selectedBox?.items.length || 0}
          errorMsg={scannerError}
        />
      )}
    </div>
  );
};

export default App;
