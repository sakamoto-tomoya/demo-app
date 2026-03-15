declare module "nodemailer" {
  function createTransport(options: unknown): { sendMail: (opts: unknown) => Promise<unknown> };
  const nodemailer: { createTransport: typeof createTransport };
  export default nodemailer;
}
