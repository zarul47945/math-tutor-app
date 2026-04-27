import { PropsWithChildren, createContext, useContext, useEffect, useState } from 'react';

import { Session, User } from '@supabase/supabase-js';

import { supabase } from '@/lib/supabase';

export type TeacherProfile = {
  id: string;
  full_name: string;
  email: string;
  role: 'teacher';
};

type SignInTeacherInput = {
  email: string;
  password: string;
};

type SignUpTeacherInput = {
  fullName: string;
  email: string;
  password: string;
};

type AuthContextValue = {
  isReady: boolean;
  profile: TeacherProfile | null;
  session: Session | null;
  signInTeacher: (input: SignInTeacherInput) => Promise<void>;
  signOutTeacher: () => Promise<void>;
  signUpTeacher: (input: SignUpTeacherInput) => Promise<{ requiresEmailVerification: boolean }>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function fallbackFullName(user: User) {
  const metadataName = user.user_metadata.full_name;

  if (typeof metadataName === 'string' && metadataName.trim()) {
    return metadataName.trim();
  }

  if (user.email) {
    return user.email.split('@')[0];
  }

  return 'Teacher';
}

async function upsertTeacherProfile(user: User, fullNameOverride?: string) {
  const fullName = fullNameOverride?.trim() || fallbackFullName(user);

  const { data, error } = await supabase
    .from('profiles')
    .upsert(
      {
        id: user.id,
        full_name: fullName,
        email: user.email ?? '',
        role: 'teacher',
      },
      {
        onConflict: 'id',
      },
    )
    .select('id, full_name, email, role')
    .single();

  if (error) {
    throw error;
  }

  return data as TeacherProfile;
}

export function AuthProvider({ children }: PropsWithChildren) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<TeacherProfile | null>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    let isMounted = true;

    const loadAuthState = async () => {
      const {
        data: { session: currentSession },
      } = await supabase.auth.getSession();

      if (!isMounted) {
        return;
      }

      setSession(currentSession);

      if (currentSession?.user) {
        try {
          const nextProfile = await upsertTeacherProfile(currentSession.user);

          if (isMounted) {
            setProfile(nextProfile);
          }
        } catch (error) {
          if (isMounted) {
            setProfile(null);
          }
          console.error('Failed to sync teacher profile during session restore.', error);
        }
      } else {
        setProfile(null);
      }

      if (isMounted) {
        setIsReady(true);
      }
    };

    loadAuthState();

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);

      if (!nextSession?.user) {
        setProfile(null);
        setIsReady(true);
        return;
      }

      upsertTeacherProfile(nextSession.user)
        .then((nextProfile) => {
          setProfile(nextProfile);
          setIsReady(true);
        })
        .catch((error) => {
          console.error('Failed to sync teacher profile after auth state change.', error);
          setProfile(null);
          setIsReady(true);
        });
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, []);

  const signInTeacher = async ({ email, password }: SignInTeacherInput) => {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Login succeeded but no teacher account was returned.');
    }

    try {
      const nextProfile = await upsertTeacherProfile(data.user);
      setSession(data.session);
      setProfile(nextProfile);
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
  };

  const signUpTeacher = async ({ fullName, email, password }: SignUpTeacherInput) => {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
          role: 'teacher',
        },
      },
    });

    if (error) {
      throw error;
    }

    if (!data.user) {
      throw new Error('Signup succeeded but no teacher account was returned.');
    }

    if (!data.session) {
      return { requiresEmailVerification: true };
    }

    try {
      const nextProfile = await upsertTeacherProfile(data.user, fullName);
      setSession(data.session);
      setProfile(nextProfile);

      return { requiresEmailVerification: false };
    } catch (error) {
      await supabase.auth.signOut();
      throw error;
    }
  };

  const signOutTeacher = async () => {
    const { error } = await supabase.auth.signOut();

    if (error) {
      throw error;
    }

    setSession(null);
    setProfile(null);
  };

  return (
    <AuthContext.Provider
      value={{
        isReady,
        profile,
        session,
        signInTeacher,
        signOutTeacher,
        signUpTeacher,
      }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);

  if (!context) {
    throw new Error('useAuth must be used inside AuthProvider.');
  }

  return context;
}
