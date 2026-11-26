import React, { useState } from 'react';
import { Loader2, ArrowDown, RefreshCw, FilterX, CheckCircle } from 'lucide-react';
import AttributeImport from './AttributeImport';
import { useCategories, getRootCategories, getChildren, ProductCategory } from '../../categories';
// Blocks of the tab
import TyresToolbar from './tyres/TyresToolbar';
import BulkActionsBar from './tyres/BulkActionsBar';
import { TyresMobileList, TyresTable, TyresGrid } from './tyres/TyresViews';
import TyreEditModal from './tyres/TyreEditModal';
import { DeleteModal, BulkDeleteModal } from './tyres/ConfirmModals';
import { AiPhotoSearchModal, BulkPhotoOverlay, AiKeyHintOverlay } from './tyres/AiPhotoModals';
// Logic
import { useMessages } from './tyres/useMessages';
import { useTyresList } from './tyres/useTyresList';
import { useRowActions } from './tyres/useRowActions';
import { useBulkActions } from './tyres/useBulkActions';
import { useAiPhotoSearch } from './tyres/useAiPhotoSearch';
import { useTyreEditor } from './tyres/useTyreEditor';
import { exportProductsCsv } from './tyres/exportProducts';

/**
 * Admin tab "Товари": the list of products with filters, quick edits, bulk actions and the edit window.
 * This file only ties the parts together; the blocks and the logic live in ./tyres.
 */
const TyresTab: React.FC = () => {
  const messages = useMessages();
  const { errorMessage, successMessage, setSuccessMessage, showError } = messages;
  const { categories, dbReady } = useCategories({ includeInactive: true });
  const list = useTyresList(categories, dbReady, showError);
  const { tyres, loadingTyres, hasMoreTyres, tyrePage, totalCount, fetchTyres, resetAllFilters, selectedTyreIds } = list;
  const row = useRowActions(list, messages);
  const bulk = useBulkActions(list, categories, messages);
  const ai = useAiPhotoSearch(list, messages);
  const editor = useTyreEditor(categories, dbReady, fetchTyres, showError);

  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [showAttrImport, setShowAttrImport] = useState(false);
  const [exporting, setExporting] = useState(false);
  /** price list for Excel: all goods of the chosen category (or everything), in stock first */
  const exportProducts = async () => {
    setExporting(true);
    try { await exportProductsCsv(categories, dbReady, list.filterCategoryId); }
    catch (e: any) { alert('Не вдалося вивантажити: ' + (e?.message || e)); }
    setExporting(false);
  };
  // Flat list "Шини", "— Легкові", ... for <select>
  const categoryOptions: { cat: ProductCategory; label: string }[] = getRootCategories(categories).flatMap(root => [
      { cat: root, label: root.name },
      ...getChildren(categories, root.id).map(child => ({ cat: child, label: `— ${child.name}` })),
  ]);

  const view = { list, row, onEdit: editor.openEditTyreModal, onAiSearch: ai.handleOpenAiSearch, setSuccessMessage };

  return (
    <div className="animate-in fade-in pb-20">
        {errorMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-red-900/90 text-white px-6 py-3 rounded-full border border-red-500 shadow-2xl">{errorMessage}</div>}
        {successMessage && <div className="fixed top-20 left-1/2 -translate-x-1/2 z-[300] bg-green-600/90 text-white px-6 py-3 rounded-full border border-green-400 shadow-2xl flex items-center gap-2"><CheckCircle size={20} />{successMessage}</div>}

        {/* --- TOP TOOLBAR --- */}
        <TyresToolbar
          list={list} categoryOptions={categoryOptions} viewMode={viewMode} setViewMode={setViewMode}
          exporting={exporting} exportProducts={exportProducts} onOpenAttrImport={() => setShowAttrImport(true)}
        />

        {selectedTyreIds.size > 0 && (
            <BulkActionsBar list={list} bulk={bulk} dbReady={dbReady} categoryOptions={categoryOptions} />
        )}

        {/* --- MAIN CONTENT --- */}
        {loadingTyres && tyres.length === 0 ? (
            <div className="flex justify-center py-20"><Loader2 className="animate-spin text-[#FFC300]" size={48} /></div>
        ) : tyres.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20 border-2 border-dashed border-zinc-800 rounded-2xl bg-zinc-900/50">
                <FilterX size={48} className="text-zinc-600 mb-4"/>
                <h3 className="text-xl font-bold text-white mb-2">Шин не знайдено</h3>
                <p className="text-zinc-400 text-sm mb-6 max-w-md text-center">Перевірте фільтри або пошуковий запит.</p>
                <button onClick={resetAllFilters} className="bg-[#FFC300] text-black font-bold px-6 py-3 rounded-xl hover:bg-[#e6b000] flex items-center gap-2"><RefreshCw size={20}/> Скинути все</button>
            </div>
        ) : viewMode === 'list' ? (
            /* --- LIST VIEW (Responsive) --- */
            <div className="space-y-3 md:space-y-0">
                {/* Mobile List View (Cards) */}
                <TyresMobileList {...view} />

                {/* Desktop List View (Table) */}
                <TyresTable {...view} />
            </div>
        ) : (
            /* --- GRID VIEW --- */
            <TyresGrid {...view} />
        )}

        {/* Load More */}
        {hasMoreTyres && tyres.length > 0 && (
            <div className="mt-8 text-center pb-8"><button onClick={() => fetchTyres(tyrePage + 1)} disabled={loadingTyres} className="bg-zinc-800 hover:bg-zinc-700 text-white font-bold py-3 px-8 rounded-xl border border-zinc-700 transition-all flex items-center gap-2 mx-auto disabled:opacity-50 min-w-[200px] justify-center">{loadingTyres ? <Loader2 className="animate-spin" /> : <ArrowDown size={20} />} Завантажити ще ({Math.max(0, totalCount - tyres.length)})</button></div>
        )}

        {/* Add/Edit Modal with PASTE Support */}
        {editor.showAddTyreModal && (
            <TyreEditModal editor={editor} categories={categories} categoryOptions={categoryOptions} dbReady={dbReady} suppliers={list.suppliers} setSuccessMessage={setSuccessMessage} />
        )}

        {/* Delete Modal */}
        {row.showDeleteModal && (
            <DeleteModal onCancel={() => { row.setShowDeleteModal(false); row.setTyreToDelete(null); }} onConfirm={row.handleDeleteTyre} />
        )}

        {/* Bulk Delete Confirmation Modal */}
        {bulk.showBulkDeleteConfirm && (
            <BulkDeleteModal count={selectedTyreIds.size} onCancel={() => bulk.setShowBulkDeleteConfirm(false)} onConfirm={bulk.executeBulkDelete} />
        )}

        {showAttrImport && <AttributeImport onClose={() => setShowAttrImport(false)} onDone={() => fetchTyres(0, true)} />}

        {/* AI SEARCH MODAL */}
        {ai.showAiSearchModal && <AiPhotoSearchModal ai={ai} />}

        {/* BULK PROCESSING OVERLAY */}
        {bulk.isBulkPhotoProcessing && (
            <BulkPhotoOverlay bulkPhotoProgress={bulk.bulkPhotoProgress} bulkPhotoTotal={bulk.bulkPhotoTotal} />
        )}

        {/* ERROR HINT OVERLAY */}
        {(bulk.showKeyNeededError || ai.apiErrorHint) && (
            <AiKeyHintOverlay onClose={() => { bulk.setShowKeyNeededError(false); ai.setApiErrorHint(false); }} />
        )}
    </div>
  );
};

export default TyresTab;
