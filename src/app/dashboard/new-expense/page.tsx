import ExpenseForm from './components/expense-form';

export default function NewExpensePage() {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="font-headline text-3xl font-bold tracking-tight">Lançar Despesa</h1>
      <p className="text-muted-foreground">
        Preencha os campos abaixo para provisionar uma nova despesa no sistema.
      </p>
      <ExpenseForm />
    </div>
  );
}
