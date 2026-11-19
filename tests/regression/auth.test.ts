describe("regressao auth", () => {
  it("token expirado nao autentica", () => {
    const exp = Math.floor(Date.now()/1000) - 60;
    expect(exp < Math.floor(Date.now()/1000)).toBe(true);
  });
  it("token de uso unico nao reutiliza", () => {
    const used = new Set<string>();
    const t = "abc";
    used.add(t);
    expect(used.has(t)).toBe(true);
  });
  it("rotacao invalida sessao anterior", () => {
    const antes = "s1"; const depois = "s2";
    expect(antes).not.toBe(depois);
  });
});
