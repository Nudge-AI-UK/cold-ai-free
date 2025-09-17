import React from 'react';

interface AvatarPlaceholderProps {
  name: string;
  className?: string;
}

const AvatarPlaceholder: React.FC<AvatarPlaceholderProps> = ({ name, className = "" }) => {
  // Get initials from name
  const getInitials = (name: string) => {
    const names = name.split(' ');
    if (names.length >= 2) {
      return `${names[0][0]}${names[names.length - 1][0]}`.toUpperCase();
    }
    return name.slice(0, 2).toUpperCase();
  };

  // Generate a consistent color based on the name
  const getColor = (name: string) => {
    const colors = [
      'from-blue-500 to-cyan-500',
      'from-purple-500 to-pink-500',
      'from-green-500 to-emerald-500',
      'from-orange-500 to-amber-500',
      'from-red-500 to-rose-500',
      'from-indigo-500 to-purple-500',
    ];
    
    let hash = 0;
    for (let i = 0; i < name.length; i++) {
      hash = name.charCodeAt(i) + ((hash << 5) - hash);
    }
    
    return colors[Math.abs(hash) % colors.length];
  };

  const initials = getInitials(name);
  const gradientColor = getColor(name);

  return (
    <div className={`relative inline-flex items-center justify-center bg-gradient-to-br ${gradientColor} rounded-full ${className}`}>
      <span className="text-white font-semibold text-sm">
        {initials}
      </span>
    </div>
  );
};

export default AvatarPlaceholder;