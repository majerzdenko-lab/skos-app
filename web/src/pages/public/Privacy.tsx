import Layout from '../../components/Layout';

export default function Privacy() {
  return (
    <Layout>
      <div className="max-w-2xl mx-auto px-4 py-10 prose prose-sm">
        <h1>Ochrana osobných údajov</h1>
        <p>
          Táto stránka je prevádzkovaná organizáciou Slovenský kosecký spolok (SKoS).
        </p>
        <h2>Aké údaje zbierame</h2>
        <ul>
          <li><strong>Meno a priezvisko</strong> — identifikácia na podujatí a vo výsledkovej listine</li>
          <li><strong>Bydlisko</strong> — zobrazuje sa vo výsledkovej listine (tradícia koseckých súťaží)</li>
          <li><strong>Dátum narodenia</strong> — zaradenie do vekovej kategórie</li>
          <li><strong>Email</strong> — notifikácie (len so súhlasom)</li>
        </ul>
        <h2>Právny základ</h2>
        <p>Oprávnený záujem / zmluva (meno, bydlisko, dátum nar.) a súhlas (email).</p>
        <h2>Vaše práva</h2>
        <p>
          Máte právo na prístup, opravu a výmaz svojich údajov. Kontaktujte nás na{' '}
          <a href="mailto:info@skos.sk">info@skos.sk</a>. Odhlásiť sa z emailových správ môžete
          priamo cez odkaz v každom emaile.
        </p>
        <h2>Kde sú údaje uložené</h2>
        <p>Databáza beží na Railway (EU región — Frankfurt). Údaje neopúšťajú EÚ.</p>
        <p className="text-gray-500 text-xs mt-8">Softvér: Veselý Kosec · veselykosec.sk</p>
      </div>
    </Layout>
  );
}
