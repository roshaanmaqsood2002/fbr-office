import { useLocation, useNavigate, type Location } from 'react-router-dom';
import BusinessForm from '../components/BusinessForm';
import Modal from '../components/Modal';

export default function BusinessNew() {
  const location = useLocation();
  const navigate = useNavigate();
  const hasBackground = !!(
    location.state as { backgroundLocation?: Location } | null
  )?.backgroundLocation;
  const close = () => navigate(hasBackground ? -1 : '/businesses');
  return (
    <Modal
      open
      title="Add a client"
      description="Create a secure workspace for a business your firm represents."
      size="lg"
      onClose={close}
    >
      <BusinessForm
        submitLabel="Create client"
        onSaved={(b) => navigate(`/businesses/${b._id}`)}
      />
      <button
        type="button"
        className="fbr-btn-secondary mt-3 w-full sm:w-auto"
        onClick={close}
      >
        Cancel
      </button>
    </Modal>
  );
}