import { useRef, useState } from 'react';
import { supabase } from '../../../supabaseClient';

/**
 * "Розумне завантаження фото": the goods a photo belongs to are found by the name of the file
 * ("Brand.Model", two or more words of the title, or the exact title / code), the file goes to the storage
 * and its address is written to those goods.
 */
export const useSmartPhotoUpload = () => {
  // SMART PHOTO MATCHER STATE
  const [smartFiles, setSmartFiles] = useState<File[]>([]);
  const [isSmartMatching, setIsSmartMatching] = useState(false);
  const [smartStatus, setSmartStatus] = useState<string[]>([]);
  const [smartOverwrite, setSmartOverwrite] = useState(false);
  const [smartExactMatch, setSmartExactMatch] = useState(false);
  const smartInputRef = useRef<HTMLInputElement>(null);

  // --- SMART UPLOAD LOGIC ---
  const handleSmartUpload = async () => {
      if (smartFiles.length === 0) return;
      setIsSmartMatching(true);
      setSmartStatus(['Початок обробки...']);

      try {
          let updatedCount = 0;

          for (const file of smartFiles) {
              const fileNameNoExt = file.name.replace(/\.[^/.]+$/, "");
              const fileNameClean = fileNameNoExt
                  .replace(/[()]/g, " ")    
                  .replace(/[-_]/g, " ");   

              let matches = [];

              // --- BRAND.MODEL MODE ---
              if (fileNameNoExt.includes('.') && !smartExactMatch) {
                  const dotIndex = fileNameNoExt.indexOf('.');
                  const brand = fileNameNoExt.substring(0, dotIndex).trim();
                  const model = fileNameNoExt.substring(dotIndex + 1).trim();

                  if (brand.length >= 2 && model.length >= 2) {
                      const { data: bmMatches } = await supabase
                          .from('tyres')
                          .select('id, title, image_url')
                          .ilike('manufacturer', `%${brand}%`)
                          .ilike('title', `%${model.replace(/[-_]/g, ' ')}%`);

                      if (bmMatches && bmMatches.length > 0) {
                          matches = bmMatches;
                          setSmartStatus(prev => [`Знайдено за Брендом.Моделлю: ${brand} ${model} (${matches.length} шт)`, ...prev]);
                      }
                  }
              }

              if (matches.length === 0) {
                  if (smartExactMatch) {
                  // --- EXACT MATCH MODE (SPECIAL MACHINERY) ---
                  const exactName = file.name.replace(/\.[^/.]+$/, "").trim();

                  const { data: exactMatches } = await supabase
                      .from('tyres')
                      .select('id, title, image_url')
                      .or(`title.ilike."${exactName}",product_number.eq."${exactName}",catalog_number.eq."${exactName}"`)
                      .limit(5);

                  matches = exactMatches || [];

                  if (matches.length === 0) {
                      setSmartStatus(prev => [`NOT FOUND (Exact): ${file.name}`, ...prev]);
                      continue;
                  }
              } else {
                  // --- KEYWORD MATCH MODE (DEFAULT) ---
                  const keywords = fileNameClean.split(/\s+/).filter(w => w.length >= 2);

                  if (keywords.length < 2) {
                      setSmartStatus(prev => [`SKIP: ${file.name} (мало ключових слів)`, ...prev]);
                      continue;
                  }

                  const sortedKeywords = [...keywords].sort((a, b) => b.length - a.length);
                  const searchTerm = sortedKeywords[0]; 

                  const { data: potentialMatches } = await supabase
                      .from('tyres')
                      .select('id, title, image_url')
                      .ilike('title', `%${searchTerm}%`)
                      .limit(50);

                  if (!potentialMatches || potentialMatches.length === 0) {
                      setSmartStatus(prev => [`NOT FOUND (By '${searchTerm}'): ${file.name}`, ...prev]);
                      continue;
                  }

                  matches = potentialMatches.filter(p => {
                      const titleLower = p.title.toLowerCase();
                      const matchCount = keywords.reduce((acc, k) => {
                          return titleLower.includes(k.toLowerCase()) ? acc + 1 : acc;
                      }, 0);

                      return matchCount >= 2; 
                  });

                  if (matches.length === 0) {
                      setSmartStatus(prev => [`NO MATCH (2+ keywords): ${file.name}`, ...prev]);
                      continue;
                  }
              }
              }

              // --- COMMON UPLOAD LOGIC ---
              const storageName = `smart_${Date.now()}_${file.name.replace(/\s/g, '_')}`;
              const { error: uploadError } = await supabase.storage.from('galery').upload(storageName, file);
              if (uploadError) {
                  setSmartStatus(prev => [`ERR UPLOAD: ${file.name}`, ...prev]);
                  continue;
              }

              const { data: urlData } = supabase.storage.from('galery').getPublicUrl(storageName);
              const publicUrl = urlData.publicUrl;

              const idsToUpdate = matches
                  .filter(p => smartOverwrite || !p.image_url)
                  .map(p => p.id);

              if (idsToUpdate.length > 0) {
                  await supabase.from('tyres').update({ image_url: publicUrl, in_stock: true }).in('id', idsToUpdate);
                  updatedCount += idsToUpdate.length;
                  setSmartStatus(prev => [`MATCHED (${smartExactMatch ? 'Exact' : 'Fuzzy'}): ${file.name} -> ${idsToUpdate.length} товарів`, ...prev]);
              } else {
                  setSmartStatus(prev => [`SKIPPED (Has Image): ${file.name}`, ...prev]);
              }
          }

          setSmartStatus(prev => [`ЗАВЕРШЕНО. Оновлено товарів: ${updatedCount}`, ...prev]);
          setSmartFiles([]);

      } catch (e: any) {
          setSmartStatus(prev => [`CRITICAL ERROR: ${e.message}`, ...prev]);
      } finally {
          setIsSmartMatching(false);
      }
  };

  return {
    smartFiles, setSmartFiles, isSmartMatching, smartStatus, smartOverwrite, setSmartOverwrite,
    smartExactMatch, setSmartExactMatch, smartInputRef, handleSmartUpload,
  };
};

export type SmartPhotoUpload = ReturnType<typeof useSmartPhotoUpload>;
