import React from 'react';
import { LucideIcon } from 'lucide-react';

interface AuthInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
    Icon: LucideIcon;
}

const AuthInput: React.FC<AuthInputProps> = ({ Icon, ...props }) => {
    return (
        <div className="flex items-center bg-[#1f2937] rounded-lg p-3 transition-all duration-200 border border-transparent focus-within:border-[#5ccfa2]">
            <Icon className="w-5 h-5 text-gray-500" />
            <input
                className="flex-grow bg-transparent border-none outline-none text-white placeholder-gray-400 ml-3 text-sm font-sans"
                {...props}
            />
        </div>
    );
};

export default AuthInput;