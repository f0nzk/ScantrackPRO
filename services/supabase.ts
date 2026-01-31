
import { createClient } from '@supabase/supabase-js';
import { TransportBox, Location, Item, BoxStatus } from '../types';

const SUPABASE_URL = 'https://uzjudduqvzfsncmqveqf.supabase.co';
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV6anVkZHVxdnpmc25jbXF2ZXFmIiwicm9sZSI6ImFub24iLCJpYXQiOjE3Njk3OTk4OTEsImV4cCI6MjA4NTM3NTg5MX0.sMoNZ7QYl1kYWL7pzmUA2akoJvC_AnhYgrO4rt_9yB0';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

export const db = {
  // --- Settings Methods ---
  async getSetting(key: string, defaultValue: string): Promise<string> {
    try {
      const { data, error } = await supabase
        .from('scantrack_settings')
        .select('value')
        .eq('key', key)
        .single();
      
      if (error && error.code === 'PGRST116') { // Not found
        await this.updateSetting(key, defaultValue);
        return defaultValue;
      }
      if (error) throw error;
      return data.value;
    } catch (err) {
      console.warn(`Setting ${key} niet gevonden, gebruik default.`);
      return defaultValue;
    }
  },

  async updateSetting(key: string, value: string) {
    try {
      const { error } = await supabase
        .from('scantrack_settings')
        .upsert({ key, value }, { onConflict: 'key' });
      if (error) throw error;
    } catch (err: any) {
      console.error("Fout bij bijwerken instelling:", err);
    }
  },

  // --- Existing Methods ---
  async checkItemExists(barcode: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('scantrack_items')
      .select('id')
      .eq('barcode', barcode)
      .limit(1);
    if (error) return false;
    return (data?.length || 0) > 0;
  },

  async checkActiveBoxExists(barcode: string): Promise<boolean> {
    const { data, error } = await supabase
      .from('scantrack_boxes')
      .select('id')
      .eq('barcode', barcode)
      .neq('status', BoxStatus.RECEIVED)
      .limit(1);
    if (error) return false;
    return (data?.length || 0) > 0;
  },

  async getLocations(): Promise<Location[]> {
    try {
      const { data, error } = await supabase.from('scantrack_locations').select('*').order('name');
      if (error) throw error;
      return data || [];
    } catch (err: any) {
      console.error("Database Error (getLocations):", err);
      throw new Error(err.message || "Kon locaties niet ophalen");
    }
  },

  async addLocation(name: string) {
    try {
      const { data, error } = await supabase
        .from('scantrack_locations')
        .insert([{ name }])
        .select();
      
      if (error) throw error;
      return data?.[0];
    } catch (err: any) {
      console.error("Database Error (addLocation):", err);
      throw new Error(err.message || "Kon locatie niet toevoegen");
    }
  },

  async deleteLocation(id: string) {
    try {
      const { error } = await supabase.from('scantrack_locations').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error("Database Error (deleteLocation):", err);
      throw new Error(err.message || "Kon locatie niet verwijderen");
    }
  },

  async getBoxes(): Promise<TransportBox[]> {
    try {
      const { data, error } = await supabase
        .from('scantrack_boxes')
        .select(`
          *,
          items:scantrack_items(*)
        `)
        .order('created_at', { ascending: false });
      
      if (error) throw error;
      
      return (data || []).map(b => ({
        id: b.id,
        barcode: b.barcode,
        status: b.status as BoxStatus,
        startLocation: b.start_location,
        createdAt: b.created_at ? new Date(b.created_at).getTime() : Date.now(),
        sealedAt: b.sealed_at ? new Date(b.sealed_at).getTime() : undefined,
        inTransitAt: b.in_transit_at ? new Date(b.in_transit_at).getTime() : undefined,
        receivedAt: b.received_at ? new Date(b.received_at).getTime() : undefined,
        items: (b.items || []).map((i: any) => ({
          id: i.id,
          barcode: i.barcode,
          timestamp: new Date(i.timestamp).getTime(),
          status: i.status
        }))
      }));
    } catch (err: any) {
      console.error("Database Error (getBoxes):", err);
      throw new Error(err.message || "Kon boxen niet ophalen");
    }
  },

  async createBox(box: Partial<TransportBox>) {
    try {
      const { data, error } = await supabase
        .from('scantrack_boxes')
        .insert([{
          barcode: box.barcode,
          status: box.status,
          start_location: box.startLocation,
          created_at: new Date().toISOString()
        }])
        .select();
      
      if (error) throw error;
      return data?.[0];
    } catch (err: any) {
      console.error("Database Error (createBox):", err);
      throw new Error(err.message || "Kon box niet aanmaken");
    }
  },

  async updateBoxStatus(id: string, status: BoxStatus) {
    try {
      const updates: any = { status };
      
      if (status === BoxStatus.SEALED) updates.sealed_at = new Date().toISOString();
      if (status === BoxStatus.IN_TRANSIT) updates.in_transit_at = new Date().toISOString();
      if (status === BoxStatus.RECEIVED) updates.received_at = new Date().toISOString();
      
      if (status === BoxStatus.ACTIVE) {
        updates.sealed_at = null;
        updates.in_transit_at = null;
        updates.received_at = null;
      } else if (status === BoxStatus.SEALED) {
        updates.in_transit_at = null;
        updates.received_at = null;
      } else if (status === BoxStatus.IN_TRANSIT) {
        updates.received_at = null;
      }

      const { error } = await supabase.from('scantrack_boxes').update(updates).eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error("Database Error (updateBoxStatus):", err);
      throw new Error(err.message || "Kon status niet bijwerken");
    }
  },

  async deleteBox(id: string) {
    try {
      const { error } = await supabase.from('scantrack_boxes').delete().eq('id', id);
      if (error) throw error;
    } catch (err: any) {
      console.error("Database Error (deleteBox):", err);
      throw new Error(err.message || "Kon box niet verwijderen");
    }
  },

  async addItemToBox(boxId: string, item: Partial<Item>) {
    try {
      const { error } = await supabase.from('scantrack_items').insert([{
        box_id: boxId,
        barcode: item.barcode,
        status: item.status,
        timestamp: new Date().toISOString()
      }]);
      
      if (error) throw error;
    } catch (err: any) {
      console.error("Database Error (addItemToBox):", err);
      throw new Error(err.message || "Kon item niet toevoegen");
    }
  },

  async deleteItem(itemId: string) {
    try {
      const { error } = await supabase.from('scantrack_items').delete().eq('id', itemId);
      if (error) throw error;
    } catch (err: any) {
      console.error("Database Error (deleteItem):", err);
      throw new Error(err.message || "Kon item niet verwijderen");
    }
  }
};
