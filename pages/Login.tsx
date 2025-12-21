
import React, { useState, useEffect } from 'react';
import { User } from '../types';
import { Lock, Phone, Scale, Smartphone, ShieldBan, Loader2, KeyRound, ShieldAlert } from 'lucide-react';
import { fetchSheetData, updateSheetData } from '../services/googleSheetsService';

interface LoginProps {
  onLogin: (user: User) => void;
}

const Login: React.FC<LoginProps> = ({ onLogin }) => {
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [browserDeviceId, setBrowserDeviceId] = useState('');

  useEffect(() => {
    let storedId = localStorage.getItem('libra_hw_id');
    if (!storedId) {
        // Generate a more robust persistent browser fingerprint
        const fingerprint = [
            navigator.userAgent.length,
            screen.colorDepth,
            new Date().getTimezoneOffset(),
            screen.height,
            screen.width,
            navigator.hardwareConcurrency || 4,
            navigator.language,
            navigator.maxTouchPoints
        ].join('-');
        
        // Create a unique hash-like ID
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        storedId = `LIBRA-${randomStr}-${fingerprint.slice(0, 10)}`;
        localStorage.setItem('libra_hw_id', storedId);
    }
    setBrowserDeviceId(storedId);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) { setError('Enter 10-digit mobile number.'); return; }
    if (!password) { setError('Access key required.'); return; }

    setLoading(true);
    setError('');

    try {
        const data = await fetchSheetData();
        const users = data?.users || [];
        const sheetUser = users.find((u: any) => String(u.phoneNumber).trim() === phone.trim());

        // 1. Check User Existence
        if (!sheetUser) {
            setError('Account not registered. Contact Admin for activation.');
            setLoading(false);
            return;
        }

        // 2. Validate Password (Access Key)
        if (password.trim() !== String(sheetUser.password).trim()) {
            setError('Incorrect Access Key. Check and try again.');
            setLoading(false);
            return;
        }

        // 3. Subscription & Password Expiry Check
        if (sheetUser.expiryDate) {
            let expiryStr = sheetUser.expiryDate;
            if (expiryStr.includes('-') && expiryStr.split('-')[0].length === 2) {
              const parts = expiryStr.split('-');
              expiryStr = `${parts[2]}-${parts[1]}-${parts[0]}`;
            }

            const expiry = new Date(expiryStr);
            if (!isNaN(expiry.getTime())) {
                expiry.setHours(23, 59, 59, 999);
                if (new Date() > expiry) {
                    setError('PASSWORD EXPIRED: Your access period has ended. Contact Admin for a NEW password.');
                    setLoading(false);
                    return;
                }
            }
        }

        // 4. RIGID DEVICE LOCKING LOGIC
        // Admins are exempt to allow management from multiple terminals
        if (!sheetUser.isAdmin) {
            const rawId = String(sheetUser.deviceId || '').trim();
            const savedDeviceId = (rawId && rawId !== "null" && rawId !== "undefined") ? rawId : null;
            
            // If device ID exists in database and it DOES NOT match the current browser ID
            if (savedDeviceId && savedDeviceId !== browserDeviceId) {
                setError('SECURITY VIOLATION: This account is locked to another device. Multi-device login is strictly prohibited.');
                setLoading(false);
                return;
            }
            
            // If no device ID is saved yet (either first login or admin reset), bind this device
            if (!savedDeviceId) {
                const updatedUser = { ...sheetUser, deviceId: browserDeviceId };
                const success = await updateSheetData('users', 'UPDATE_USER', updatedUser, sheetUser.id);
                if (!success) {
                    console.warn("Could not bind device ID to sheet, proceeding with local bind.");
                }
            }
        }

        onLogin({
            id: sheetUser.id,
            phoneNumber: phone,
            name: sheetUser.name,
            expiryDate: sheetUser.expiryDate,
            isAdmin: sheetUser.isAdmin,
            deviceId: browserDeviceId
        });
    } catch (err) {
        console.error("Login failure:", err);
        setError('System Sync Error. Check your internet connection or try again later.');
    } finally {
        setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#020617] flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-slate-900 border border-slate-800 rounded-2xl shadow-2xl overflow-hidden relative">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600"></div>
        
        <div className="p-8">
            <div className="text-center mb-8">
                <div className="w-16 h-16 bg-gradient-to-tr from-blue-600 to-indigo-700 rounded-2xl mx-auto flex items-center justify-center mb-4 shadow-lg shadow-blue-500/20">
                    <Scale size={32} strokeWidth={2} className="text-white" />
                </div>
                <h1 className="text-2xl font-bold text-white tracking-tight">LibraQuant</h1>
                <p className="text-slate-400 text-sm mt-1 uppercase tracking-widest font-mono text-[10px]">Institutional Terminal Access</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6">
                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Subscriber Mobile</label>
                    <div className="relative">
                        <Phone className="absolute left-3 top-3.5 text-slate-500" size={16} />
                        <input 
                            type="tel" 
                            maxLength={10}
                            value={phone}
                            onChange={(e) => setPhone(e.target.value.replace(/\D/g, ''))}
                            placeholder="Registered Mobile"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 font-mono"
                        />
                    </div>
                </div>

                <div>
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">30-Day Access Key</label>
                    <div className="relative">
                        <KeyRound className="absolute left-3 top-3.5 text-slate-500" size={16} />
                        <input 
                            type="password" 
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            placeholder="Enter Key"
                            className="w-full bg-slate-950 border border-slate-700 rounded-xl py-3.5 pl-10 pr-4 text-white focus:ring-1 focus:ring-blue-500/50 focus:border-blue-500 outline-none transition-all placeholder:text-slate-700 font-mono"
                        />
                    </div>
                </div>

                {error && (
                    <div className="bg-rose-950/30 border border-rose-500/30 rounded-xl p-4 flex items-start space-x-3 animate-in fade-in slide-in-from-bottom-2">
                        <ShieldAlert size={18} className="text-rose-500 mt-0.5 shrink-0" />
                        <span className="text-rose-400 text-[11px] font-bold uppercase tracking-tight leading-relaxed">{error}</span>
                    </div>
                )}

                <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center text-sm uppercase tracking-widest">
                    {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                    {loading ? 'Securing Link...' : 'Sign In To Terminal'}
                </button>
            </form>

            <div className="mt-8 pt-6 border-t border-slate-800/50 text-center">
                <p className="text-[10px] text-slate-600 font-mono leading-relaxed uppercase tracking-tighter">
                    Account locks to initial device ID.<br/>
                    Contact admin for hardware resets.
                </p>
            </div>
        </div>
        <div className="bg-slate-950/50 p-4 text-center border-t border-slate-800">
            <div className="flex items-center justify-center text-[10px] text-slate-500 font-mono">
                <Smartphone size={10} className="mr-2 text-slate-700" />
                <span className="truncate max-w-[200px]">HARDWARE ID: {browserDeviceId}</span>
            </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
