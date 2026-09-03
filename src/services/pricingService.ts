import { db } from '../db';
import type { PriceEntry } from '../types';

export interface PriceLookupParams {
  modelId: string;
  materialName: string;
  width: number;
  height: number;
  colourId?: string;
  frameId?: string;
}

export interface PriceLookupResult {
  found: boolean;
  price?: number;
  matchedRule?: PriceEntry;
  matchType?: 'EXACT' | 'GENERIC';
  message?: string;
}

export async function lookupPrice(params: PriceLookupParams): Promise<PriceLookupResult> {
  const { modelId, materialName, width, height, colourId, frameId } = params;

  if (!modelId || !materialName || !width || !height) {
    return {
      found: false,
      message: 'Veuillez renseigner le modèle, la matière et les dimensions.'
    };
  }

  const entries = await db.priceEntries
    .where('modelId')
    .equals(modelId)
    .toArray();

  const matchingDimensionsAndMaterial = entries.filter((e) => {
    return (
      e.materialName.toLowerCase() === materialName.toLowerCase() &&
      Number(e.width) === Number(width) &&
      Number(e.height) === Number(height)
    );
  });

  // 1. Exact match with colour and frame if specified
  if (colourId && frameId) {
    const exact = matchingDimensionsAndMaterial.find(
      (e) => e.colourId === colourId && e.frameId === frameId
    );
    if (exact) {
      return {
        found: true,
        price: exact.price,
        matchedRule: exact,
        matchType: 'EXACT'
      };
    }
  }

  // 2. Match with frame only or colour only
  if (frameId) {
    const frameMatch = matchingDimensionsAndMaterial.find(
      (e) => e.frameId === frameId && !e.colourId
    );
    if (frameMatch) {
      return {
        found: true,
        price: frameMatch.price,
        matchedRule: frameMatch,
        matchType: 'EXACT'
      };
    }
  }

  // 3. Generic match (model + material + width + height without colour/frame constraint)
  const generic = matchingDimensionsAndMaterial.find(
    (e) => !e.colourId && !e.frameId
  );
  if (generic) {
    return {
      found: true,
      price: generic.price,
      matchedRule: generic,
      matchType: 'GENERIC'
    };
  }

  // 4. Any match for this dimension
  if (matchingDimensionsAndMaterial.length > 0) {
    const firstMatch = matchingDimensionsAndMaterial[0];
    return {
      found: true,
      price: firstMatch.price,
      matchedRule: firstMatch,
      matchType: 'GENERIC'
    };
  }

  return {
    found: false,
    message: 'Prix non défini — veuillez saisir le prix ou créer une tarification.'
  };
}

export async function savePriceEntry(entry: Omit<PriceEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }): Promise<string> {
  const now = new Date().toISOString();
  const id = entry.id || 'prc_' + Math.random().toString(36).substring(2, 9) + Date.now().toString(36);
  
  const fullEntry: PriceEntry = {
    ...entry,
    id,
    createdAt: now,
    updatedAt: now
  };

  await db.priceEntries.put(fullEntry);
  return id;
}

export async function deletePriceEntry(id: string): Promise<void> {
  await db.priceEntries.delete(id);
}
