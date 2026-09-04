import re

file_path = "c:\\Users\\sebas\\Desktop\\agenteInteligente\\agencia-ia-core\\services\\p2p-marketplace\\src\\p2p-command\\p2p-command.service.ts"
with open(file_path, "r", encoding="utf-8") as f:
    content = f.read()

target = r"""                } catch (e: any) {
                    // IMPORTANTE: NO marcar como COMPLETED si hay error de red o timeout"""

replacement = r"""                } catch (e: any) {
                    if (e.response && e.response.data && e.response.data.ret_code && (e.response.data.ret_code === 10001 || e.response.data.ret_code === 40002 || e.response.data.ret_code === 40001 || e.response.data.ret_code > 0)) {
                        this.logger.log(`Order ${localOrder.bybitOrderId} dropped from Bybit con error explícito de API (${e.response.data.ret_code}). Assuming COMPLETED/CANCELLED.`);
                        await this.prisma.bybitP2pOrder.update({
                            where: { bybitOrderId: localOrder.bybitOrderId },
                            data: { status: 'COMPLETED' }
                        });
                        continue;
                    }
                    // IMPORTANTE: NO marcar como COMPLETED si hay error de red o timeout"""

# Handle crlf
target = target.replace("\n", "\r\n") if "\r\n" in content else target
replacement = replacement.replace("\n", "\r\n") if "\r\n" in content else replacement

new_content = content.replace(target, replacement)
with open(file_path, "w", encoding="utf-8") as f:
    f.write(new_content)

print("Replaced" if new_content != content else "Not Replaced")
