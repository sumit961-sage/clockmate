import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface BackButtonProps {
  label?: string;
  onClick?: () => void;
}

export default function BackButton({ label = 'Back', onClick }: BackButtonProps) {
  const navigate = useNavigate();

  const handleClick = () => {
    if (onClick) {
      onClick();
    } else {
      navigate(-1);
    }
  };

  return (
    <Button
      variant="ghost"
      size="sm"
      onClick={handleClick}
      className="text-slate-600 hover:text-slate-900 -ml-2"
    >
      <ArrowLeft className="size-4 mr-1" />
      {label}
    </Button>
  );
}
