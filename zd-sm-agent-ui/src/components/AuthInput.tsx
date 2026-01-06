'use client';

import React, { useState } from 'react';
import { LucideIcon, Eye, EyeOff } from 'lucide-react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    Icon: LucideIcon;
}

const AuthInput: React.FC<AuthInputProps> = ({ Icon, type, ...props }) => {
    const [showPassword, setShowPassword] = useState(false);
    const isPasswordField = type === 'password';
    
    return (
        <div className="flex items-center bg-[#1f2937] rounded-lg p-3 transition-all duration-200 border border-transparent focus-within:border-[#5ccfa2] relative">
            <Icon className="w-5 h-5 text-gray-500" />
            <input
                type={isPasswordField && showPassword ? 'text' : type}
                className="flex-grow bg-transparent border-none outline-none text-white placeholder-gray-400 ml-3 text-sm font-sans pr-10"
                {...props}
            />
            {isPasswordField && (
                <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 text-gray-400 hover:text-[#5ccfa2] transition-colors focus:outline-none"
                    tabIndex={-1}
                >
                    {showPassword ? (
                        <EyeOff className="w-5 h-5" />
                    ) : (
                        <Eye className="w-5 h-5" />
                    )}
                </button>
            )}
        </div>
    );
};

export default AuthInput;