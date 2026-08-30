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
    <header className="sticky top-0 z-40 bg-white/95 backdrop-blur-md border-b border-teal-100/80 shadow-xs">
      <div className="max-w-7xl mx-auto px-3 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-14 sm:h-18 gap-2">
          
          {/* Left Brand / Logo */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 shrink-0">
            <div className="w-8 h-8 sm:w-11 sm:h-11 rounded-xl sm:rounded-2xl bg-gradient-to-br from-teal-500 to-emerald-600 flex items-center justify-center text-white shadow-sm sm:shadow-md shadow-teal-500/20 shrink-0">
              <Heart className="w-4 h-4 sm:w-6 sm:h-6 fill-white/20 animate-pulse" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1.5 sm:gap-2">
                <span className="font-black text-base sm:text-xl text-teal-950 tracking-tight shrink-0">
                  NSPC
                </span>
                <span className="hidden md:inline-block px-2 py-0.5 text-[11px] font-semibold rounded-full bg-teal-100 text-teal-800 border border-teal-200">
                  NICU RSUD Undata
                </span>
              </div>
              <p className="text-[11px] text-slate-500 hidden lg:block truncate">
                Neo Smart Progress Card • Memantau Perkembangan Bayi Terpadu
              </p>
            </div>
          </div>

          {/* Right Action Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2.5 shrink-0 min-w-0">
            {currentRole === 'parent' && currentPatient && (
              <>
                <button
                  type="button"
                  onClick={onShareLink}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 sm:px-3 sm:py-2 text-xs sm:text-sm font-medium rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-colors shrink-0 cursor-pointer"
                  title="Bagikan Tautan Orang Tua"
                >
                  <Share2 className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0" />
                  <span className="hidden sm:inline">Bagikan Link</span>
                </button>

                <div className="flex items-center gap-1.5 bg-slate-50 px-2 sm:px-3 py-1.5 rounded-xl border border-slate-200 text-[11px] sm:text-xs max-w-[120px] sm:max-w-[160px]">
                  <User className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                  <span className="font-medium text-slate-700 truncate">
                    {currentPatient.babyName}
                  </span>
                </div>
              </>
            )}

            {(currentRole === 'nakes' || currentNakesUser) && (
              <button
                type="button"
                onClick={onOpenNakesProfile}
                className="flex items-center gap-1.5 sm:gap-2 bg-teal-50/90 hover:bg-teal-100 border border-teal-200/80 hover:border-teal-300 text-teal-900 px-2 sm:px-3 py-1.5 rounded-xl text-xs sm:text-sm font-semibold shadow-2xs transition-all cursor-pointer group min-w-0 max-w-[180px] sm:max-w-[280px]"
                title="Pengaturan Edit Profile Admin Nakes"
              >
                <div className="w-5 h-5 sm:w-6 sm:h-6 rounded-lg bg-teal-100 flex items-center justify-center shrink-0">
                  <Stethoscope className="w-3 h-3 sm:w-3.5 sm:h-3.5 text-teal-700" />
                </div>
                <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 truncate">
                  <span className="truncate text-[11px] sm:text-xs font-bold text-teal-950">
                    {currentNakesUser ? currentNakesUser.name : 'Nakes Admin'}
                  </span>
                  {currentNakesUser?.isSuperAdmin || currentNakesUser?.username === 'superadmin' ? (
                    <span className="px-1.5 py-0.5 bg-amber-200 text-amber-950 font-black rounded-md text-[9px] sm:text-[10px] shrink-0 whitespace-nowrap hidden xs:inline-block">
                      Super Admin
                    </span>
                  ) : currentNakesUser?.hasAccessRights ? (
                    <span className="px-1.5 py-0.5 bg-teal-200 text-teal-950 font-bold rounded-md text-[9px] sm:text-[10px] shrink-0 whitespace-nowrap hidden xs:inline-block">
                      Hak Akses
                    </span>
                  ) : (
                    <BadgeCheck className="w-3.5 h-3.5 text-teal-600 shrink-0 hidden xs:inline-block" />
                  )}
                </div>
              </button>
            )}

            {currentRole ? (
              <button
                type="button"
                onClick={onLogout}
                className="inline-flex items-center justify-center gap-1.5 p-2 sm:px-3 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl text-slate-600 hover:text-rose-600 hover:bg-rose-50 border border-slate-200 hover:border-rose-200 transition-all shrink-0 cursor-pointer"
                title="Keluar Akun"
              >
                <LogOut className="w-4 h-4 text-slate-600 hover:text-rose-600" />
                <span className="hidden sm:inline">Keluar</span>
              </button>
            ) : (
              <div className="flex items-center gap-1.5 sm:gap-2">
                <button
                  type="button"
                  onClick={() => onOpenLogin('parent')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl text-teal-700 bg-teal-50 hover:bg-teal-100 border border-teal-200 transition-all shadow-2xs whitespace-nowrap cursor-pointer"
                >
                  <Heart className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-teal-600 shrink-0" />
                  <span>Orang Tua</span>
                </button>

                <button
                  type="button"
                  onClick={() => onOpenLogin('nakes')}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 sm:px-3.5 sm:py-2 text-xs sm:text-sm font-semibold rounded-xl text-white bg-teal-600 hover:bg-teal-700 transition-all shadow-sm shadow-teal-600/20 whitespace-nowrap cursor-pointer"
                >
                  <Lock className="w-3.5 h-3.5 sm:w-4 sm:h-4 shrink-0" />
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
