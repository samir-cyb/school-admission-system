import { Link } from "react-router";
import { Compass } from "lucide-react";
import { useI18n } from "../i18n/I18nProvider";
import { EmptyState } from "../components/States";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="container">
      <EmptyState
        icon={<Compass size={28} />}
        text={t("notFound.title")}
        action={
          <Link to="/classes" className="btn btn--primary">
            {t("notFound.action")}
          </Link>
        }
      />
    </div>
  );
}
