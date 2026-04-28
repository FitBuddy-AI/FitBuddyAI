import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_KEY;
const supabase = createClient(SUPABASE_URL, SUPABASE_KEY);

export default async function handler(req, res) {
  const { id } = req.query;
  if (!id) return res.status(400).json({ message: 'User ID required.' });
  try {
    if (req.method === 'GET') {
      const { data, error } = await supabase
        .from('fitbuddyai_userdata')
        .select('*')
        .eq('user_id', id)
        .limit(1)
        .maybeSingle();
      if (error) {
        console.error('Supabase error fetching user:', error);
        return res.status(500).json({ message: 'Supabase error.' });
      }
      if (!data) return res.status(404).json({ message: 'User not found.' });
      const { password: _password, ...userSafe } = data;
      return res.status(200).json({ user: userSafe });
    }

    // POST actions for nested routes (workout_plan, assessment)
    if (req.method === 'POST') {
      const action = String(req.query.action || req.body?.action || '').toLowerCase();
      if (action === 'workout_plan') {
        // For now this app stores workout plan in user_data table; proxy to that API or return 404
        return res.status(404).json({ message: 'No workout plan found.' });
      }
      if (action === 'assessment') {
        return res.status(404).json({ message: 'No assessment found.' });
      }
      if (action === 'buy') {
        const body = req.body || {};
        const item = body.item || null;
        if (!item || typeof item !== 'object') {
          return res.status(400).json({ message: 'Item required.' });
        }

        const price = Number(item.price || 0);
        if (isNaN(price) || price < 0) {
          return res.status(400).json({ message: 'Invalid item price.' });
        }

        const authHeader = String(req.headers.authorization || req.headers.Authorization || '');
        const token = authHeader && authHeader.toLowerCase().startsWith('bearer ') ? authHeader.slice(7) : null;
        if (!token) {
          return res.status(401).json({ message: 'Missing Authorization token.' });
        }

        try {
          const { data: authData, error: authErr } = await supabase.auth.getUser(token);
          if (authErr || !authData || !authData.user) {
            return res.status(401).json({ message: 'Invalid or expired token.' });
          }
          if (authData.user.id !== id) {
            return res.status(403).json({ message: 'Token does not match user.' });
          }
        } catch (err) {
          return res.status(401).json({ message: 'Invalid or expired token.' });
        }

        const { data: userData, error: fetchErr } = await supabase
          .from('fitbuddyai_userdata')
          .select('*')
          .eq('user_id', id)
          .limit(1)
          .maybeSingle();
        if (fetchErr) {
          console.error('Supabase error fetching user for purchase:', fetchErr);
          return res.status(500).json({ message: 'Supabase error.' });
        }
        if (!userData) {
          return res.status(404).json({ message: 'User not found.' });
        }

        const currentEnergy = Number(userData.energy || 0);
        if (currentEnergy < price) {
          return res.status(409).json({ message: 'Insufficient energy to purchase item.' });
        }

        const existingInventory = Array.isArray(userData.inventory) ? userData.inventory : [];
        const purchasedItem = {
          ...item,
          price,
          quantity: Number.isFinite(Number(item.quantity)) ? Number(item.quantity) : item.quantity,
          purchased_at: new Date().toISOString()
        };
        const newInventory = [...existingInventory, purchasedItem];
        const newEnergy = currentEnergy - price;

        const { data: updated, error: updateErr } = await supabase
          .from('fitbuddyai_userdata')
          .update({ inventory: newInventory, energy: newEnergy })
          .eq('user_id', id)
          .select()
          .maybeSingle();
        if (updateErr) {
          console.error('Supabase error updating purchase:', updateErr);
          return res.status(500).json({ message: 'Supabase error.' });
        }
        if (!updated) {
          return res.status(500).json({ message: 'Failed to update user.' });
        }

        const { password: _password, ...userSafe } = updated;
        return res.status(200).json({ user: userSafe });
      }
      // Fallback: unsupported POST
      return res.status(400).json({ message: 'Bad request' });
    }
  } catch (err) {
    console.error('Handler error:', err);
    return res.status(500).json({ message: 'Server error.' });
  }
}
