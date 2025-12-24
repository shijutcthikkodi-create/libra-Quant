
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
        
        const randomStr = Math.random().toString(36).substring(2, 8).toUpperCase();
        storedId = `LIBRA-${randomStr}-${fingerprint.slice(0, 10)}`;
        localStorage.setItem('libra_hw_id', storedId);
    }
    setBrowserDeviceId(storedId);

    // Initialize Apple ID
    if ((window as any).AppleID) {
      (window as any).AppleID.auth.init({
        clientId: 'com.libraquant.client', // Replace with your real Client ID
        scope: 'name email',
        redirectURI: window.location.origin,
        usePopup: true
      });
    }
  }, []);

  const handleAppleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const response = await (window as any).AppleID.auth.signIn();
      // In a real app, verify the response.authorization.id_token with your backend
      console.log('Apple Auth Response:', response);
      
      const data = await fetchSheetData();
      const users = data?.users || [];
      
      // Look for user by Apple ID or Email (mocked for demo as matching by ID)
      const appleId = response.user?.email || response.authorization.id_token.substring(0, 10);
      const sheetUser = users.find((u: any) => u.id === appleId || u.phoneNumber.includes(appleId));

      if (!sheetUser) {
        setError('Apple account not linked to an active subscription.');
        setLoading(false);
        return;
      }

      // Proceed with standard login success logic
      completeLogin(sheetUser);
    } catch (err) {
      console.error('Apple Login Error:', err);
      setError('Apple authentication failed.');
      setLoading(false);
    }
  };

  const completeLogin = async (sheetUser: any) => {
    if (!sheetUser.isAdmin) {
        const rawId = String(sheetUser.deviceId || '').trim();
        const savedDeviceId = (rawId && rawId !== "" && rawId !== "null" && rawId !== "undefined") ? rawId : null;
        
        if (savedDeviceId && savedDeviceId !== browserDeviceId) {
            setError(`SECURITY LOCK: Account active on another terminal. Reset required. Device ID: ${browserDeviceId.slice(0, 8)}`);
            setLoading(false);
            return;
        }
        
        if (!savedDeviceId) {
            const updatedUser = { ...sheetUser, deviceId: browserDeviceId };
            await updateSheetData('users', 'UPDATE_USER', updatedUser, sheetUser.id);
            await updateSheetData('logs', 'ADD', {
              timestamp: new Date().toISOString(),
              user: sheetUser.name,
              action: 'DEVICE_BIND',
              details: `Locked to ${browserDeviceId.slice(0, 12)}`,
              type: 'SECURITY'
            });
        }
    }

    await updateSheetData('logs', 'ADD', {
        timestamp: new Date().toISOString(),
        user: sheetUser.name,
        action: 'LOGIN_SUCCESS',
        details: `Device: ${browserDeviceId.slice(0, 8)}`,
        type: 'SECURITY'
    });

    onLogin({
        id: sheetUser.id,
        phoneNumber: sheetUser.phoneNumber || '',
        name: sheetUser.name,
        expiryDate: sheetUser.expiryDate,
        isAdmin: sheetUser.isAdmin,
        deviceId: browserDeviceId
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (phone.length < 10) { setError('Enter 10-digit mobile number.'); return; }
    if (!password) { setError('Access key required.'); return; }

    setLoading(true);
    setError('');

    try {
        const data = await fetchSheetData();
        const users = data?.users || [];
        
        const cleanInputPhone = phone.replace(/\D/g, '').slice(-10);

        const sheetUser = users.find((u: any) => {
            const cleanSheetPhone = String(u.phoneNumber || '').replace(/\D/g, '').slice(-10);
            return cleanSheetPhone === cleanInputPhone;
        });

        if (!sheetUser) {
            setError('Account not registered. Please contact Admin with your ID: ' + browserDeviceId.slice(0, 8));
            setLoading(false);
            return;
        }

        if (password.trim() !== String(sheetUser.password).trim()) {
            setError('Incorrect Access Key. Check and try again.');
            setLoading(false);
            return;
        }

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
                    setError('ACCESS EXPIRED: Your current key has ended. Renew subscription for a NEW key.');
                    setLoading(false);
                    return;
                }
            }
        }

        completeLogin(sheetUser);
    } catch (err) {
        console.error("Login failure:", err);
        setError('System Sync Error. Check connection or try again.');
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
                    <label className="block text-[10px] font-bold text-slate-500 mb-1.5 uppercase tracking-widest">Access Key</label>
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

                <div className="space-y-3">
                  <button type="submit" disabled={loading} className="w-full bg-blue-600 hover:bg-blue-500 text-white font-bold py-4 rounded-xl transition-all shadow-xl shadow-blue-900/20 disabled:opacity-50 flex items-center justify-center text-sm uppercase tracking-widest">
                      {loading ? <Loader2 className="animate-spin mr-2" size={18} /> : null}
                      {loading ? 'Authenticating...' : 'Sign In To Terminal'}
                  </button>

                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-800"></div>
                    <span className="flex-shrink mx-4 text-[10px] text-slate-600 uppercase font-black">or</span>
                    <div className="flex-grow border-t border-slate-800"></div>
                  </div>

                  {/* Apple Sign In Button */}
                  <button 
                    type="button" 
                    onClick={handleAppleLogin}
                    disabled={loading}
                    className="w-full bg-white hover:bg-slate-100 text-black font-bold py-3.5 rounded-xl transition-all flex items-center justify-center space-x-2 shadow-lg disabled:opacity-50"
                  >
                    <svg className="w-5 h-5" viewBox="0 0 256 315" xmlns="http://www.w3.org/2000/svg" preserveAspectRatio="xMidYMid">
                      <path d="M213.803 167.03c.442 47.58 41.74 63.413 42.147 63.615-.35 1.116-6.599 22.563-21.757 44.716-13.104 19.153-26.705 38.235-48.13 38.63-21.05.388-27.82-12.483-51.888-12.483-24.053 0-31.482 12.093-51.48 12.87-20.78.775-36.31-20.726-49.52-39.784C5.9 256.402-14.28 190.39 6.846 153.74c10.518-18.257 29.273-29.82 49.614-30.116 15.632-.303 30.33 10.512 39.914 10.512 9.574 0 27.28-12.9 45.96-10.99 7.82.32 29.757 3.164 43.83 23.79-.115.07-26.335 15.403-26.36 46.084M176.024 74.34c20.326-24.588 19.016-46.856 18.06-56.516-17.756 1.444-39.22 12.463-51.96 27.31-11.42 13.113-21.43 35.736-18.73 54.875 19.863 1.54 39.873-10.428 52.63-25.67" fill="currentColor"/>
                    </svg>
                    <span className="text-sm">Continue with Apple</span>
                  </button>
                </div>
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
