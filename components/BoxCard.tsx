
import React from 'react';
import { Package, ChevronRight, Truck, CheckCircle, PackageOpen, MapPin, Lock } from 'lucide-react';
import { TransportBox, BoxStatus } from '../types';

interface BoxCardProps {
  box: TransportBox;
  onClick: () => void;
}

const BoxCard: React.FC<BoxCardProps> = ({ box, onClick }) => {
  const getStatusConfig = (status: BoxStatus) => {
    switch (status) {
      case BoxStatus.ACTIVE:
        return { 
          icon: <PackageOpen className="w-3.5 h-3.5" />, 
          bg: 'bg-green-50 text-green-700 border-green-200', 
          label: 'Actief' 
        };
      case BoxStatus.SEALED:
        return { 
          icon: <Lock className="w-3.5 h-3.5" />, 
          bg: 'bg-orange-50 text-orange-700 border-orange-200', 
          label: 'Verzegeld' 
        };
      case BoxStatus.IN_TRANSIT:
        return { 
          icon: <Truck className="w-3.5 h-3.5" />, 
          bg: 'bg-blue-50 text-blue-700 border-blue-200', 
          label: 'Onderweg' 
        };
      case BoxStatus.RECEIVED:
        return { 
          icon: <CheckCircle className="w-3.5 h-3.5" />, 
          bg: 'bg-slate-100 text-slate-600 border-slate-200', 
          label: 'Ontvangen' 
        };
      default:
        return { 
          icon: <Package className="w-3.5 h-3.5" />, 
          bg: 'bg-slate-50 text-slate-500 border-slate-200', 
          label: 'Wachtend' 
        };
    }
  };

  const config = getStatusConfig(box.status);

  return (
    <div 
      onClick={onClick}
      className="bg-white border border-slate-200 rounded-lg overflow-hidden hover:border-certe-light transition-all cursor-pointer group shadow-sm flex flex-col h-full"
    >
      <div className="p-4 flex-1">
        <div className="flex justify-between items-start mb-3">
           <div className={`px-2 py-0.5 rounded border text-[10px] font-bold uppercase tracking-wider flex items-center gap-1 ${config.bg}`}>
            {config.icon}
            {config.label}
          </div>
          <span className="text-[10px] text-slate-400 font-medium">
            {new Date(box.createdAt).toLocaleDateString('nl-NL')}
          </span>
        </div>
        
        <h3 className="text-lg font-bold text-[#003153] mb-1 group-hover:text-[#009FE3] transition-colors truncate">
          {box.barcode}
        </h3>
        
        <div className="flex items-center gap-1.5 text-slate-500">
          <MapPin className="w-3 h-3 text-[#009FE3]" />
          <p className="text-xs font-medium uppercase tracking-tight">{box.startLocation}</p>
        </div>
      </div>
      
      <div className="px-4 py-3 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest">
          {box.items.length} {box.items.length === 1 ? 'item' : 'items'}
        </p>
        <ChevronRight className="w-4 h-4 text-[#009FE3] group-hover:translate-x-1 transition-transform" />
      </div>
    </div>
  );
};

export default BoxCard;
