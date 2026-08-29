import React from 'react';
import { UserRole, Patient, NakesUser } from '../types';
import { Stethoscope, Heart, Lock, LogOut, Share2, Sparkles, User, RefreshCw, BadgeCheck } from 'lucide-react';

interface NavbarProps {
  currentRole: UserRole;
  currentPatient: Patient | null;
  currentNakesUser?: NakesUser | null;
  onOpenLogin: (role: UserRole) => void;
  onLogout: () => void;
  onShareLink?: () => void;
  onOpenNakesProfile?: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({
  currentRole,
  currentPatient,
  currentNakesUser,
  onOpenLogin,
  onLogout,
  onShareLink,
  onOpenNakesProfile,
}) => {
  return (
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-teal-100 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-20">
          
          {/* Left Brand / Logo */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 sm:w-12 sm:h-12 rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-md shadow-teal-500/20">
              <Heart className="w-6 h-6 fill-white/20 animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-lg sm:text-xl text-teal-950 tracking-tight">
                  NSPC
                </span>
                <span className="hidden lg:inline-block px-2 py-0.5 text-xs font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  NICU RSUD Undata
                </span>
              </div>
              <p className="text-xs text-slate-500 hidden lg:block">
                Neo Smart Progress Card • Memantau Perkembangan Bayi Terpadu
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {currentRole === 'parent' && currentPatient && (
              <>
                <button
                  onClick={onShareLink}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors"
                  title="Bagikan Tautan Orang Tua"
                >
                  <Share2 className="w-4 h-4 text-teal-600" />
                  <span className="hidden sm:inline">Bagikan Link</span>
                </button>

                <div className="hidden sm:flex items-center gap-2 bg-slate-50 px-3 py-1.5 rounded-xl border border-slate-200 text-xs">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span className="font-medium text-slate-700 truncate max-w-[140px]">
                    {currentPatient.babyName}
                  </span>
                </div>
              </>
            )}

            {(currentRole === 'nakes' || currentNakesUser) && (
              <button
                type="button"
                onClick={onOpenNakesProfile}
                className="flex items-center gap-2 bg-teal-50 hover:bg-teal-100 border border-teal-200 hover:border-teal-300 text-teal-800 px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer group"
                title="Pengaturan Edit Profile Admin Nakes"
              >
                <Stethoscope className="w-4 h-4 text-teal-600 shrink-0" />
                <div className="flex items-center gap-1.5">
                  <span>{currentNakesUser ? currentNakesUser.name : 'Nakes Admin'}</span>
                  {currentNakesUser?.isSuperAdmin || currentNakesUser?.username === 'superadmin' ? (
                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black rounded text-[9px]">
                      Super Admin
                    </span>
                  ) : currentNakesUser?.hasAccessRights ? (
                    <span className="px-1.5 py-0.5 bg-teal-200 text-teal-950 font-bold rounded text-[9px]">
                      Hak Akses
                    </span>
                  ) : (
                    <BadgeCheck className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  )}
                </div>
              </button>
            )}

            {currentRole ? (
              <button
                onClick={onLogout}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs sm:text-sm font-medium rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all"
                title="Keluar Akun"
              >
                <LogOut className="w-4 h-4" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            ) : (
              <div className="flex items-center gap-2">
                <button
                  onClick={() => onOpenLogin('parent')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all shadow-2xs"
                >
                  <Heart className="w-4 h-4 text-teal-600" />
                  <span>Akses Orang Tua</span>
                </button>

                <button
                  onClick={() => onOpenLogin('nakes')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-md shadow-teal-600/20"
                >
                  <Lock className="w-4 h-4" />
                  <span>Login Nakes</span>
                </button>
              </div>
            )}
          </div>

        </div>
      </div>
    </header>
  );
};
