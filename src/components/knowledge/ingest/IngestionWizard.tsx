import React, { useState, useRef } from 'react';
import {
  FileText,
  ArrowRight,
  Cpu,
  Zap,
  ChevronLeft,
  Lock,
  Upload,
  Calendar,
  User,
  Link2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../../../lib/utils';
import { useAppState } from '../../../AppStateContext';
import { STEPS, SOURCES, formatBytes } from './ingest.data';

export const IngestionWizard = ({ onComplete, onCancel }: { onComplete: () => void, onCancel: () => void }) => {
  const { addDocument, user } = useAppState();
  const [currentStep, setCurrentStep] = useState(0);
  const [selectedSource, setSelectedSource] = useState<'video' | 'image' | 'doc' | 'web' | null>(null);

  // Form Fields
  const [assetName, setAssetName] = useState('');
  const [webUrl, setWebUrl] = useState('');
  const [author, setAuthor] = useState('');
  const [publishedDate, setPublishedDate] = useState('');

  // Local uploaded state
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadedFile, setUploadedFile] = useState<{ name: string; size: string; type: string } | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Ingest state
  const [isAddingInProcess, setIsAddingInProcess] = useState(false);
  const [ingestionLogs, setIngestionLogs] = useState<string[]>([]);

  // Locked parameters
  const [imageMetadata, setImageMetadata] = useState({
    type: 'PNG',
    fileSize: '3.4 MB',
    height: '1080px',
    width: '1920px',
    colorSpace: 'sRGB (Display P3)'
  });

  const [videoMetadata, setVideoMetadata] = useState({
    type: 'MP4 / H.264',
    fileSize: '52.4 MB',
    height: '2160p (4K)',
    width: '3840px',
    totalFrame: '24,800'
  });

  const handleSourceSelect = (sourceId: 'video' | 'image' | 'doc' | 'web') => {
    setSelectedSource(sourceId);
    setCurrentStep(1); // Auto-advance instantly on choice! Removes the "Configure" button step.
    setErrorMsg(null);
  };

  const handleFileUploadClick = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const cleanName = file.name.replace(/\.[^/.]+$/, "");
      setAssetName(cleanName);
      const sizeFormatted = formatBytes(file.size);
      
      setUploadedFile({
        name: file.name,
        size: sizeFormatted,
        type: file.name.split('.').pop()?.toUpperCase() || 'RAW'
      });

      if (selectedSource === 'image') {
        setImageMetadata({
          type: file.name.split('.').pop()?.toUpperCase() || 'PNG',
          fileSize: sizeFormatted,
          height: '1440px',
          width: '2560px',
          colorSpace: 'sRGB (Display P3)'
        });
      } else if (selectedSource === 'video') {
        setVideoMetadata({
          type: file.name.split('.').pop()?.toUpperCase() || 'MP4',
          fileSize: sizeFormatted,
          height: '1080px',
          width: '1920px',
          totalFrame: '11,250'
        });
      }
      setErrorMsg(null);
    }
  };

  const executeAddData = () => {
    if (!selectedSource) return;

    if (selectedSource === 'web') {
      if (!assetName.trim()) {
        setErrorMsg('Web Portal Name is required.');
        return;
      }
      if (!webUrl.trim()) {
        setErrorMsg('URL Endpoint is required.');
        return;
      }
      if (!webUrl.startsWith('http://') && !webUrl.startsWith('https://')) {
        setErrorMsg('Web URLs must declare absolute http:// or https:// protocol.');
        return;
      }
    } else {
      if (!assetName.trim()) {
        setErrorMsg('A valid file name is required.');
        return;
      }
    }

    setIsAddingInProcess(true);
    setErrorMsg(null);

    const logList = [
      'Establishing Bronze-Level ingestion pipeline stream...',
      'Mapping payload storage allocations... COMPLETED',
      'Locking hardware metadata & extraction fingerprints...',
      'Verifying digital signatures against tenant policies...',
      'Transferring chunks into global Data Lake (Bronze)... SUCCESS'
    ];

    let pointer = 0;
    setIngestionLogs([logList[0]]);

    const interval = setInterval(() => {
      pointer++;
      if (pointer < logList.length) {
        setIngestionLogs(prev => [...prev, logList[pointer]]);
      } else {
        clearInterval(interval);
        
        // Build final document name
        const finalName = selectedSource === 'web' 
          ? assetName
          : `${assetName}.${uploadedFile?.type?.toLowerCase() || (selectedSource === 'doc' ? 'pdf' : selectedSource === 'image' ? 'png' : 'mp4')}`;

        // Construct customized metadata
        const metadataRecord: Record<string, any> = {
          tenant: 'GlobalCorp',
          type: selectedSource === 'doc' ? 'PDF' : selectedSource === 'image' ? 'Image' : selectedSource === 'video' ? 'Video' : 'Web Index',
        };

        if (selectedSource === 'image') {
          Object.assign(metadataRecord, imageMetadata);
        } else if (selectedSource === 'video') {
          Object.assign(metadataRecord, videoMetadata);
        } else if (selectedSource === 'doc') {
          metadataRecord.author = author || 'Anonymous';
          metadataRecord.publishedDate = publishedDate || 'N/A';
        } else if (selectedSource === 'web') {
          metadataRecord.url = webUrl;
        }

        addDocument({
          name: finalName,
          layer: 'BRONZE',
          author: selectedSource === 'doc' && author ? author : user.name || 'AI Engineer',
          metadata: metadataRecord
        });

        setTimeout(() => {
          onComplete();
        }, 800);
      }
    }, 550);
  };

  const prevStep = () => {
    setErrorMsg(null);
    setCurrentStep(0);
  };

  return (
    <div className="flex flex-col h-full bg-[#FCFBF7] text-[#111111] select-none">
      
      {/* Hidden file selector trigger */}
      <input 
        type="file" 
        ref={fileInputRef} 
        onChange={handleFileChange}
        className="hidden"
        accept={
          selectedSource === 'image' ? 'image/*' :
          selectedSource === 'video' ? 'video/*' :
          selectedSource === 'doc' ? '.pdf,.docx,.txt,.md' :
          '*'
        }
      />

      {/* Header and Step Indicators */}
      <div className="px-8 py-4 bg-[#FFFDF6] border-b border-[#D6C79F]">
        <div className="flex justify-between items-center relative max-w-sm mx-auto">
          <div className="absolute left-0 right-0 h-0.5 bg-[#D6C79F] top-1/2 -translate-y-1/2 z-0" />
          {STEPS.map((step, idx) => (
            <div key={step.id} className="relative z-10 flex flex-col items-center gap-1">
              <div className={cn(
                "w-7 h-7 rounded-full border-2 flex items-center justify-center text-[11px] font-black transition-all duration-300",
                currentStep === idx 
                  ? "bg-[#B88719] border-[#8A5A00] text-white scale-110 shadow-md shadow-[#B88719]/20" 
                  : currentStep > idx 
                  ? "bg-[#2F4F0B] border-[#6B8E23] text-white" 
                  : "bg-white border-[#BFA66A] text-[#5A5A5A]"
              )}>
                {currentStep > idx ? <Check className="w-3.5 h-3.5 stroke-[3]" /> : idx + 1}
              </div>
              <span className={cn(
                "text-[9px] font-bold uppercase tracking-wider",
                currentStep === idx ? "text-[#8A5A00]" : "text-[#5A5A5A]"
              )}>{step.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Main Body Canvas - Beautifully scrollable vertically if too long */}
      <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar">
        <AnimatePresence mode="wait">
          
          {/* A. Progress State */}
          {isAddingInProcess ? (
            <motion.div
              key="process-state"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center justify-center h-full py-12 text-center"
            >
              <div className="relative mb-6">
                <div className="w-14 h-14 rounded-full border-4 border-[#F3E2A7] border-t-[#B88719] animate-spin" />
                <Cpu className="w-5 h-5 text-[#B88719] absolute top-4.5 left-4.5 animate-pulse" />
              </div>

              <h3 className="text-lg font-bold font-display text-[#111111] uppercase tracking-wide">Adding Data Stream</h3>
              <p className="text-[#5A5A5A] text-xs mt-1">Routing file credentials to active Bronze storage segment</p>

              <div className="w-full max-w-md bg-[#111111] border-2 border-[#8A5A00] rounded-2xl p-5 text-left font-mono mt-6 h-40 overflow-y-auto shadow-md">
                {ingestionLogs.map((log, idx) => (
                  <div key={idx} className="flex gap-2 items-start text-xs py-0.5">
                    <span className="text-[#B88719] shrink-0 font-bold">&gt;</span>
                    <span className={idx === ingestionLogs.length - 1 ? "text-[#FFFDF6] font-bold" : "text-slate-400"}>
                      {log}
                    </span>
                  </div>
                ))}
              </div>
            </motion.div>
          )

          /* B. Step 1: Select Source Type (Clicking automatically triggers progression!) */
          : currentStep === 0 ? (
            <motion.div
              key="step-select"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-6"
            >
              <div className="text-center max-w-md mx-auto">
                <h3 className="text-lg font-bold text-[#111111] tracking-tight uppercase font-display">Select Data Source</h3>
                <p className="text-[#5A5A5A] text-xs mt-1">Click one option below to instantly begin metadata configuration</p>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 max-w-xl mx-auto">
                {SOURCES.map(src => {
                  const SvgIcon = src.icon;
                  return (
                    <button
                      key={src.id}
                      onClick={() => handleSourceSelect(src.id as any)}
                      className="p-5 rounded-2xl text-left border-2 transition-all outline-none duration-150 relative overflow-hidden flex flex-col justify-between h-40 border-[#BFA66A] hover:border-[#8A5A00] bg-white hover:bg-[#FFFDF3] hover:shadow-md cursor-pointer"
                    >
                      <div className="w-9 h-9 rounded-xl flex items-center justify-center mb-4 bg-[#FFFDF6] border border-[#BFA66A] text-[#8A5A00]">
                        <SvgIcon className="w-4.5 h-4.5" />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase tracking-wider text-[#111111]">{src.name}</h4>
                        <p className="text-[10px] text-[#5A5A5A] mt-1 leading-normal">{src.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </motion.div>
          )

          /* C. Step 2: Configure Properties (Vertical form layouts with labels stacked atop inputs) */
          : (
            <motion.div
              key="step-metadata"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="space-y-5 max-w-xl mx-auto"
            >
              <div className="text-center mb-2">
                <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#FFF9E8] border border-[#BFA66A] rounded-full text-[10px] text-[#8A5A00] font-mono font-bold uppercase mb-2">
                  <Zap className="w-3 h-3 text-[#B88719]" />
                  Active Ingestion: {selectedSource && SOURCES.find(s => s.id === selectedSource)?.name}
                </span>
                <h3 className="text-lg font-bold text-[#111111] uppercase tracking-tight">Configure properties</h3>
                <p className="text-[#5A5A5A] text-xs">Verify values. System registers parameters and bundles payload directly to Bronze tier.</p>
              </div>

              {/* Stacked Vertical Row Form */}
              <div className="bg-white border-2 border-[#BFA66A] rounded-2xl p-6 space-y-5 shadow-sm">
                
                {/* 1. Upload Section in full vertical stack */}
                {selectedSource !== 'web' && (
                  <div className="flex flex-col gap-1.5 pb-4 border-b border-[#FAF6EA]">
                    <span className="text-[10px] font-black uppercase tracking-widest text-[#111111]">Source Payload *</span>
                    <span className="text-[10px] text-[#5A5A5A] mb-1">Upload a valid raw resource file from your machine</span>
                    
                    <div className="w-full">
                      {uploadedFile ? (
                        <div className="p-3 bg-[#FFFDF6] border border-[#BFA66A] rounded-xl flex items-center justify-between">
                          <div className="flex items-center gap-3 overflow-hidden">
                            <div className="p-2 bg-[#F3E2A7] border border-[#BFA66A] text-[#8A5A00] rounded-lg shrink-0">
                              <FileText className="w-4 h-4" />
                            </div>
                            <div className="overflow-hidden">
                              <div className="text-xs font-bold text-[#111111] truncate">{uploadedFile.name}</div>
                              <div className="text-[10px] font-mono text-[#5A5A5A] mt-0.5">{uploadedFile.size} • {uploadedFile.type}</div>
                            </div>
                          </div>
                          <button
                            type="button"
                            onClick={handleFileUploadClick}
                            className="text-[10px] font-black uppercase text-[#8A5A00] hover:text-[#5A4209] transition-colors border border-[#8A5A00] px-2.5 py-1 rounded-lg bg-white"
                          >
                            Replace
                          </button>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={handleFileUploadClick}
                          className="w-full py-5 bg-[#FFFDF6] hover:bg-[#FFF9E8] border-2 border-dashed border-[#BFA66A] hover:border-[#8A5A00] rounded-xl flex flex-col items-center justify-center gap-1.5 transition-all group cursor-pointer"
                        >
                          <Upload className="w-4.5 h-4.5 text-[#8A5A00] group-hover:scale-105 transition-transform" />
                          <span className="text-[10px] font-black uppercase tracking-wider text-[#111111]">Upload Resource</span>
                        </button>
                      )}
                    </div>
                  </div>
                )}

                {/* 2. Common Name row (Vertical Stack) */}
                <div className="flex flex-col gap-1.5 pb-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-[#111111]">
                    {selectedSource === 'web' ? 'Web Portal Name *' : 'Knowledge Name *'}
                  </label>
                  <span className="text-[10px] text-[#5A5A5A] mb-1">Dynamic system identifier assigned to resource</span>
                  <input
                    type="text"
                    placeholder={selectedSource === 'web' ? "e.g., AeroFlow Web Documentation" : "e.g., enterprise_sso_schema"}
                    value={assetName}
                    onChange={(e) => setAssetName(e.target.value)}
                    className="field-input text-xs font-mono"
                  />
                </div>

                {/* 3. Web URL parameters row (Vertical Stack) */}
                {selectedSource === 'web' && (
                  <div className="flex flex-col gap-1.5 pb-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-[#111111]">URL Endpoint *</label>
                    <span className="text-[10px] text-[#5A5A5A] mb-1">Absolute online source crawl destination</span>
                    <div className="relative">
                      <Link2 className="w-3.5 h-3.5 text-[#8A5A00] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        placeholder="https://docs.aeroflow.ai/index"
                        value={webUrl}
                        onChange={(e) => setWebUrl(e.target.value)}
                        className="field-input pl-9 text-xs font-mono"
                      />
                    </div>
                  </div>
                )}

                {/* 4. Document-specific parameter rows (Vertical Stack) */}
                {selectedSource === 'doc' && (
                  <>
                    <div className="flex flex-col gap-1.5 pb-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#111111]">Author / Contributor</label>
                      <span className="text-[10px] text-[#5A5A5A] mb-1">Author name tagged inside index ledger</span>
                      <div className="relative">
                        <User className="w-3.5 h-3.5 text-[#8A5A00] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="Optional"
                          value={author}
                          onChange={(e) => setAuthor(e.target.value)}
                          className="field-input pl-9 text-xs"
                        />
                      </div>
                    </div>

                    <div className="flex flex-col gap-1.5 pb-2">
                      <label className="text-[10px] font-black uppercase tracking-widest text-[#111111]">Published Date</label>
                      <span className="text-[10px] text-[#5A5A5A] mb-1">Time or year signature of artifact publishment</span>
                      <div className="relative">
                        <Calendar className="w-3.5 h-3.5 text-[#8A5A00] absolute left-3 top-1/2 -translate-y-1/2" />
                        <input
                          type="text"
                          placeholder="YYYY-MM-DD (Optional)"
                          value={publishedDate}
                          onChange={(e) => setPublishedDate(e.target.value)}
                          className="field-input pl-9 text-xs font-mono"
                        />
                      </div>
                    </div>
                  </>
                )}

                {/* 5. Image details metadata row (Vertical Stack) */}
                {selectedSource === 'image' && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#FAF6EA]">
                    <div className="text-[10px] font-black text-[#8A5A00] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#B88719]" />
                      AUTO-EXTRACTED METADATA (SYSTEM LOCKED)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#FFFDF6] border border-[#BFA66A] p-3 rounded-xl">
                      {[
                        { label: 'format', val: imageMetadata.type },
                        { label: 'file_size', val: imageMetadata.fileSize },
                        { label: 'height', val: imageMetadata.height },
                        { label: 'width', val: imageMetadata.width },
                        { label: 'color_space', val: imageMetadata.colorSpace }
                      ].map(item => (
                        <div key={item.label} className="p-2 border border-[#EBE3CD] rounded-lg bg-white">
                          <span className="text-[9px] font-bold text-[#5A5A5A] uppercase tracking-wider block mb-0.5">{item.label}</span>
                          <span className="font-mono text-[11px] text-[#111111] font-semibold">{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 6. Video details metadata row (Vertical Stack) */}
                {selectedSource === 'video' && (
                  <div className="flex flex-col gap-2 pt-2 border-t border-[#FAF6EA]">
                    <div className="text-[10px] font-black text-[#8A5A00] flex items-center gap-1.5">
                      <Lock className="w-3.5 h-3.5 text-[#B88719]" />
                      AUTO-EXTRACTED PARAMETERS (SYSTEM LOCKED)
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 bg-[#FFFDF6] border border-[#BFA66A] p-3 rounded-xl">
                      {[
                        { label: 'type', val: videoMetadata.type },
                        { label: 'file_size', val: videoMetadata.fileSize },
                        { label: 'height', val: videoMetadata.height },
                        { label: 'width', val: videoMetadata.width },
                        { label: 'total_frame', val: videoMetadata.totalFrame }
                      ].map(item => (
                        <div key={item.label} className="p-2 border border-[#EBE3CD] rounded-lg bg-white">
                          <span className="text-[9px] font-bold text-[#5A5A5A] uppercase tracking-wider block mb-0.5">{item.label}</span>
                          <span className="font-mono text-[11px] text-[#111111] font-semibold">{item.val}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Error message display slot */}
      {errorMsg && !isAddingInProcess && (
        <div className="px-8 pb-3">
          <div className="px-4 py-2.5 bg-[#FAF1F1] border border-[#C94A4A]/30 rounded-xl flex items-center gap-3 text-xs text-[#9F1D1D] font-medium leading-relaxed">
            <AlertCircle className="w-4 h-4 shrink-0 text-[#9F1D1D]" />
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      {/* Footer Navigation tray - Custom adjusted */}
      {!isAddingInProcess && (
        <div className="p-6 border-t border-[#BFA66A] bg-[#FAF6EA] flex justify-between items-center shrink-0">
          {currentStep === 1 ? (
            <button
              onClick={prevStep}
              className="btn-secondary h-10 px-4 flex items-center gap-1.5"
            >
              <ChevronLeft className="w-4 h-4" />
              BACK
            </button>
          ) : (
            <div className="w-4" />
          )}
          
          <div className="flex gap-2">
            <button
              onClick={onCancel}
              className="btn-secondary h-10 px-5 text-xs text-[#5A5A5A] border-none hover:bg-[#F3E2A7]/20"
            >
              Cancel
            </button>

            {currentStep === 1 && (
              <button
                onClick={executeAddData}
                className="btn-gold h-10 px-6 font-black uppercase text-glow"
              >
                Add Data File
                <ArrowRight className="w-4.5 h-4.5 ml-1 inline-block" />
              </button>
            )}
          </div>
        </div>
      )}

    </div>
  );
};
