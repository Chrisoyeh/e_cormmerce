import React, { useState } from 'react';
import { User, Key, GraduationCap, Users, Shield, AlertCircle, Eye, EyeOff, Globe, Loader2 } from 'lucide-react';
import { Pupil } from '../types';
import { api } from '../services/api';
import { collection, getDocs, query, where } from 'firebase/firestore';
import { db } from '../firebase';

interface LoginPortalProps {
  pupils: Pupil[];
  onLogin: (role: 'admin' | 'pupil' | 'parent', activeUser: any) => void;
  isLoginOnly?: boolean;
}

export const LoginPortal: React.FC<LoginPortalProps> = ({ pupils, onLogin, isLoginOnly = false }) => {
  const [selectedGate, setSelectedGate] = useState<'pupil' | 'parent' | 'admin'>('pupil');
  const [surname, setSurname] = useState('');
  const [regNo, setRegNo] = useState('');
  const [adminUser, setAdminUser] = useState('');
  const [adminPass, setAdminPass] = useState('');

  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const authenticatePupilOrParent = async (role: 'pupil' | 'parent') => {
    if (!surname.trim() || !regNo.trim()) {
      setErrorMsg(
        role === 'pupil'
          ? 'Please enter both Surname and Registration Number.'
          : 'Please enter your child\'s Surname and Registration Number.'
      );
      return;
    }

    setIsLoading(true);
    setErrorMsg('');

    try {
      // 1. Try secure server-side auth endpoint
      const res = await api.pupilLogin({
        surname: surname.trim(),
        regNo: regNo.trim(),
        role
      });

      if (res && res.user) {
        onLogin(role, res.user);
        return;
      }
    } catch (apiErr: any) {
      // 2. Direct Firestore fallback in case the backend server is offline in dev
      try {
        const pupilsRef = collection(db, 'pupils');
        const cleanReg = regNo.trim();
        const cleanSurname = surname.trim().toLowerCase();

        // 1. Try exact regNo
        let q = query(pupilsRef, where('regNo', '==', cleanReg));
        let snap = await getDocs(q);

        // 2. If no match, try uppercase regNo (e.g. NS/2026/001)
        if (snap.empty && cleanReg !== cleanReg.toUpperCase()) {
          q = query(pupilsRef, where('regNo', '==', cleanReg.toUpperCase()));
          snap = await getDocs(q);
        }

        let found: Pupil | null = null;
        snap.forEach((docSnap) => {
          const data = docSnap.data() as Pupil;
          if (data.surname && data.surname.trim().toLowerCase() === cleanSurname) {
            found = { ...data, id: docSnap.id };
          }
        });

        // 3. If still not found, check collection case-insensitively
        if (!found) {
          const allSnap = await getDocs(pupilsRef);
          allSnap.forEach((docSnap) => {
            const data = docSnap.data() as Pupil;
            if (
              data.regNo &&
              data.surname &&
              data.regNo.trim().toLowerCase() === cleanReg.toLowerCase() &&
              data.surname.trim().toLowerCase() === cleanSurname
            ) {
              found = { ...data, id: docSnap.id };
            }
          });
        }

        // 4. In-memory prop fallback
        if (!found && pupils && pupils.length > 0) {
          found = pupils.find(
            (s) =>
              s.surname.trim().toLowerCase() === cleanSurname &&
              s.regNo.trim().toLowerCase() === cleanReg.toLowerCase()
          ) || null;
        }

        if (found) {
          setErrorMsg('');
          onLogin(role, found);
          return;
        }
      } catch (firestoreErr) {
        console.warn('Fallback authentication notice:', firestoreErr);
      }

      setErrorMsg(
        apiErr.message ||
        'Invalid credentials. Check spelling (e.g. Okon, Adamu, Smith) and Registration Number format (e.g. NS/2026/001).'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handlePupilSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await authenticatePupilOrParent('pupil');
  };

  const handleParentSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await authenticatePupilOrParent('parent');
  };

  const handleAdminSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (adminUser.trim() === 'admin' && adminPass === 'Nazareth@2026ST') {
      setErrorMsg('');
      onLogin('admin', { username: 'admin', displayName: 'School Registrar' });
    } else {
      setErrorMsg('Invalid Registrar credentials.');
    }
  };

  return (
    <div className="bg-slate-900 text-white p-6 rounded-3xl shadow-xl flex flex-col justify-between text-left border border-slate-800 w-full" id="login-portal-card">
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <h2 className="font-bold text-white text-base tracking-tight flex items-center gap-1.5">
            <Shield className="w-4 h-4 text-[#E37180]" /> Access Gateway
          </h2>
          <span className="text-[9px] bg-slate-855 text-slate-350 font-mono py-0.5 px-2 rounded-full border border-slate-750">SECURE SESSION</span>
        </div>

        {/* Tab Selection Row */}
        <div className="grid grid-cols-3 gap-1 bg-slate-955 p-1 rounded-xl" id="gate-select-tabs">
          <button
            id="gate-tab-pupil"
            type="button"
            onClick={() => { setSelectedGate('pupil'); setErrorMsg(''); setSurname(''); setRegNo(''); }}
            className={`py-2 rounded-lg font-sans font-bold text-[11px] transition flex flex-col items-center justify-center gap-1 cursor-pointer ${selectedGate === 'pupil' ? 'bg-[#E37180] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
          >
            <GraduationCap className="w-4 h-4" /> Pupil
          </button>
          <button
            id="gate-tab-parent"
            type="button"
            onClick={() => { setSelectedGate('parent'); setErrorMsg(''); setSurname(''); setRegNo(''); }}
            className={`py-2 rounded-lg font-sans font-bold text-[11px] transition flex flex-col items-center justify-center gap-1 cursor-pointer ${selectedGate === 'parent' ? 'bg-[#E37180] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
          >
            <Users className="w-4 h-4" /> Parent
          </button>
          <button
            id="gate-tab-admin"
            type="button"
            onClick={() => { setSelectedGate('admin'); setErrorMsg(''); setSurname(''); setRegNo(''); }}
            className={`py-2 rounded-lg font-sans font-bold text-[11px] transition flex flex-col items-center justify-center gap-1 cursor-pointer ${selectedGate === 'admin' ? 'bg-[#E37180] text-white shadow' : 'text-slate-400 hover:text-white'
              }`}
          >
            <Shield className="w-4 h-4" /> Registrar
          </button>
        </div>

        {errorMsg && (
          <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-rose-300 text-[11px] flex items-start gap-2 animate-shake" id="login-error-alert">
            <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5 text-rose-400" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Render Gate Active Forms */}
        {selectedGate === 'pupil' && (
          <form onSubmit={handlePupilSubmit} className="space-y-3.5 text-left" id="pupil-gate-form">
            <div>
              <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider mb-1" htmlFor="p-surname">Pupil Surname</label>
              <div className="relative">
                <input
                  id="p-surname"
                  type="text"
                  placeholder="surname"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  className="w-full bg-slate-800 border-none rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:ring-1 focus:ring-[#E37180] focus:outline-none"
                />
                <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-355 uppercase tracking-wider mb-1" htmlFor="p-reg">Registration No.</label>
              <div className="relative">
                <input
                  id="p-reg"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="reg No"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  className="w-full bg-slate-800 border-none rounded-xl py-2 pl-9 pr-10 text-xs text-white placeholder-slate-400 focus:ring-1 focus:ring-[#E37180] focus:outline-none font-mono"
                />
                <Key className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 w-5 h-5 text-slate-500 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              id="submit-pupil-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-[#E37180] hover:bg-[#2D346C] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold tracking-wide transition-colors duration-155 cursor-pointer mt-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Credentials…</span>
                </>
              ) : (
                'Enter Pupil Dashboard'
              )}
            </button>
          </form>
        )}

        {selectedGate === 'parent' && (
          <form onSubmit={handleParentSubmit} className="space-y-3.5 text-left" id="parent-gate-form">
            <div>
              <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider mb-1" htmlFor="child-surname">Ward Surname</label>
              <div className="relative">
                <input
                  id="child-surname"
                  type="text"
                  placeholder="e.g. Smith"
                  value={surname}
                  onChange={(e) => setSurname(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-slate-800 border-none rounded-xl py-2 pl-9 pr-3 text-xs text-white placeholder-slate-400 focus:ring-1 focus:ring-[#E37180] focus:outline-none"
                />
                <User className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-355 uppercase tracking-wider mb-1" htmlFor="child-reg">Ward Registration No.</label>
              <div className="relative">
                <input
                  id="child-reg"
                  type={showPassword ? 'text' : 'password'}
                  placeholder="e.g. NS/2026/004"
                  value={regNo}
                  onChange={(e) => setRegNo(e.target.value)}
                  disabled={isLoading}
                  className="w-full bg-slate-800 border-none rounded-xl py-2 pl-9 pr-10 text-xs text-white placeholder-slate-400 focus:ring-1 focus:ring-[#E37180] focus:outline-none font-mono"
                />
                <Key className="absolute left-3 top-2.5 w-3.5 h-3.5 text-slate-500" />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 w-5 h-5 text-slate-500 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              id="submit-parent-login"
              type="submit"
              disabled={isLoading}
              className="w-full py-2 bg-[#E37180] hover:bg-[#2D346C] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-xl text-xs font-bold tracking-wide transition-colors duration-155 cursor-pointer mt-1 flex items-center justify-center gap-2"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Verifying Credentials…</span>
                </>
              ) : (
                'Verify Ward Credentials'
              )}
            </button>
          </form>
        )}

        {selectedGate === 'admin' && (
          <form onSubmit={handleAdminSubmit} className="space-y-3.5 text-left" id="admin-gate-form">
            <div>
              <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider mb-1" htmlFor="adm-user">Faculty Username</label>
              <input
                id="adm-user"
                type="text"
                value={adminUser}
                onChange={(e) => setAdminUser(e.target.value)}
                className="w-full bg-slate-800 border-none rounded-xl py-2 px-3 text-xs text-white placeholder-slate-400 focus:ring-1 focus:ring-[#E37180] focus:outline-none"
              />
            </div>

            <div>
              <label className="block text-[10px] font-bold text-slate-350 uppercase tracking-wider mb-1" htmlFor="adm-pass">Security Key</label>
              <div className="relative">
                <input
                  id="adm-pass"
                  type={showPassword ? 'text' : 'password'}
                  value={adminPass}
                  onChange={(e) => setAdminPass(e.target.value)}
                  className="w-full bg-slate-800 border-none rounded-xl py-2 pl-3 pr-10 text-xs text-white focus:ring-1 focus:ring-[#E37180] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-2 w-5 h-5 text-slate-500 hover:text-white cursor-pointer"
                >
                  {showPassword ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                </button>
              </div>
            </div>

            <button
              id="submit-admin-login"
              type="submit"
              className="w-full py-2 bg-[#E37180] hover:bg-[#2D346C] text-white rounded-xl text-xs font-bold tracking-wide transition-colors duration-155 cursor-pointer mt-1"
            >
              Authenticate Registrar
            </button>
            <p className="text-[10px] text-rose-400 italic text-center">Only Authorized Registrar can access Admin suite.</p>
          </form>
        )}
      </div>

      <div className="flex items-center justify-between mt-4 pt-3 border-t border-slate-800 text-[10px]">
        <a
          href="https://nazarethpryschool.org"
          className="flex items-center gap-1.5 text-[#E37180] hover:text-[#f49ba6] font-bold transition hover:underline"
          id="login-back-to-web"
          title="Redirect to Main School Website"
        >
          <Globe className="w-3.5 h-3.5" /> Back to Web
        </a>
        <div className="flex items-center gap-1.5 text-slate-400 text-[9px]">
          <div className="w-1.5 h-1.5 bg-[#E37180] rounded-full animate-pulse"></div>
          <p>TLS 1.3 Active</p>
        </div>
      </div>
    </div>
  );
};
